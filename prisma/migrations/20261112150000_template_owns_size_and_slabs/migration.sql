-- The structure template now decides a structure's inside size and slabs.
--
-- DATA ONLY: no table or column changes. This converts any rows saved under
-- the old rules so nothing changes size or loses a slab:
--
--   1. A round template that still offers several diameters is split into one
--      template per diameter, named with the size ("SC Storm 4'"). The first
--      diameter keeps the original record; structures, quote lines and Quick
--      Build drafts follow their own diameter.
--   2. A rectangular structure (or open quote line) saved without a slab its
--      template has, or at a different inside size than its template, moves
--      to a copy of that template that matches it ("C-2 - No Top Slab").
--
-- When every round template already has one diameter and every rectangular
-- structure already matches its template, this changes nothing.
--
-- The conversion runs in one guarded block: if anything unexpected happens it
-- is rolled back as a whole and reported as a warning, never as a failed
-- migration. The app handles unconverted rows.

DO $$
DECLARE
  t RECORD;
  d RECORD;
  v RECORD;
  dr RECORD;
  n INT;
  k INT;
  base_name TEXT;
  new_name TEXT;
  new_id TEXT;
  suffix TEXT;
  doc JSONB;
  sec JSONB;
  new_rows JSONB;
  split_count INT := 0;
  variant_count INT := 0;
  num_re CONSTANT TEXT := '^[0-9]+(\.[0-9]+)?$';
BEGIN
  BEGIN
    CREATE TEMP TABLE _tpl_split (
      old_id TEXT NOT NULL,
      dia NUMERIC NOT NULL,
      new_id TEXT NOT NULL,
      new_name TEXT NOT NULL
    ) ON COMMIT DROP;

    CREATE TEMP TABLE _tpl_variant (
      old_id TEXT NOT NULL,
      has_top BOOLEAN NOT NULL,
      has_base BOOLEAN NOT NULL,
      len INT,
      wid INT,
      new_id TEXT NOT NULL,
      new_name TEXT NOT NULL
    ) ON COMMIT DROP;

    -- -----------------------------------------------------------------
    -- 1. Round templates: one diameter (one mold) per template.
    -- -----------------------------------------------------------------
    FOR t IN
      SELECT st.id, st.name
      FROM "StructureTemplate" st
      WHERE st.shape = 'CIRCULAR'
        AND (
          SELECT count(*) FROM "StructureTemplateDiameter" x
          WHERE x."templateId" = st.id
        ) > 1
      ORDER BY st.name
    LOOP
      n := 0;
      FOR d IN
        SELECT x.id, x."insideDiameterFeet" AS dia
        FROM "StructureTemplateDiameter" x
        WHERE x."templateId" = t.id
        ORDER BY x."sortOrder", x."insideDiameterFeet", x.id
      LOOP
        n := n + 1;
        -- 4.00 -> 4', 7.33 -> 7.33'
        base_name := t.name || ' '
          || trim(trailing '.' from trim(trailing '0' from d.dia::text))
          || '''';
        new_name := base_name;
        k := 1;
        WHILE EXISTS (
          SELECT 1 FROM "StructureTemplate" s
          WHERE s.name = new_name AND NOT (n = 1 AND s.id = t.id)
        ) LOOP
          k := k + 1;
          new_name := base_name || ' (' || k || ')';
        END LOOP;

        IF n = 1 THEN
          -- The original record keeps its first diameter.
          UPDATE "StructureTemplate"
          SET name = new_name, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = t.id;
          INSERT INTO _tpl_split VALUES (t.id, d.dia, t.id, new_name);
        ELSE
          new_id := 'c' || substr(
            md5(random()::text || clock_timestamp()::text || d.id), 1, 24);
          INSERT INTO "StructureTemplate" (
            id, name, "agencyStandard", shape, status, notes, "createdAt",
            "updatedAt", "baseSlabThicknessInches", "castingProductId",
            "connectionType", "minimumBrickInches",
            "openingToJointMinBottomInches", "openingToJointMinTopInches",
            "sumpFixedInches", "sumpMode", "topSlabThicknessInches",
            "wallThicknessInches", "rectMinPricingHeightFeet", "rectPdfSetId",
            "topSlabOpeningInches", "rectTopSlabOpeningLengthInches",
            "rectTopSlabOpeningWidthInches", "rectTopSlabOpeningSide"
          )
          SELECT
            new_id, new_name, "agencyStandard", shape, status, notes,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "baseSlabThicknessInches",
            "castingProductId", "connectionType", "minimumBrickInches",
            "openingToJointMinBottomInches", "openingToJointMinTopInches",
            "sumpFixedInches", "sumpMode", "topSlabThicknessInches",
            "wallThicknessInches", "rectMinPricingHeightFeet", "rectPdfSetId",
            "topSlabOpeningInches", "rectTopSlabOpeningLengthInches",
            "rectTopSlabOpeningWidthInches", "rectTopSlabOpeningSide"
          FROM "StructureTemplate" WHERE id = t.id;
          -- The diameter row itself moves to the new template.
          UPDATE "StructureTemplateDiameter"
          SET "templateId" = new_id, "sortOrder" = 0,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = d.id;
          INSERT INTO _tpl_split VALUES (t.id, d.dia, new_id, new_name);
          split_count := split_count + 1;
        END IF;
      END LOOP;
    END LOOP;

    IF EXISTS (SELECT 1 FROM _tpl_split) THEN
      -- Structures follow the diameter they were built at. One saved at a
      -- size the template never offered stays on the original record.
      UPDATE "JobStructure" s
      SET "structureTemplateId" = m.new_id
      FROM _tpl_split m, "JobStructureCalc" c
      WHERE c."jobStructureId" = s.id
        AND s."structureTemplateId" = m.old_id
        AND m.new_id <> m.old_id
        AND c."insideDiameterFeet" IS NOT NULL
        AND abs(c."insideDiameterFeet" - m.dia) < 0.005;

      -- Quote lines carry the template and diameter in their config.
      UPDATE "QuoteLineItem" q
      SET "structureConfigJson" = jsonb_set(
        jsonb_set(q."structureConfigJson", '{templateId}', to_jsonb(m.new_id)),
        '{templateName}', to_jsonb(m.new_name))
      FROM _tpl_split m
      WHERE jsonb_typeof(q."structureConfigJson") = 'object'
        AND q."structureConfigJson"->>'templateId' = m.old_id
        AND coalesce(q."structureConfigJson"->>'shape', '') <> 'RECTANGULAR'
        AND CASE
          WHEN (q."structureConfigJson"->>'diameterFeet') ~ num_re
          THEN abs((q."structureConfigJson"->>'diameterFeet')::numeric - m.dia) < 0.005
          ELSE false
        END;

      -- Quick Build drafts: the setup and every row name a template and a
      -- diameter. A draft that cannot be read is left alone.
      FOR dr IN SELECT id, "draftJson" FROM "OneOffDraft" LOOP
        BEGIN
          doc := dr."draftJson"::jsonb;
          sec := doc->'circular';
          IF jsonb_typeof(sec) = 'object' THEN
            new_id := NULL;
            SELECT m.new_id INTO new_id
            FROM _tpl_split m
            WHERE m.old_id = sec->'setup'->>'templateId'
              AND CASE
                WHEN (sec->'setup'->>'diameterFeet') ~ num_re
                THEN abs((sec->'setup'->>'diameterFeet')::numeric - m.dia) < 0.005
                ELSE false
              END
            LIMIT 1;
            IF new_id IS NOT NULL THEN
              doc := jsonb_set(doc, '{circular,setup,templateId}', to_jsonb(new_id));
            END IF;

            IF jsonb_typeof(sec->'rows') = 'array' THEN
              SELECT coalesce(
                jsonb_agg(
                  CASE
                    WHEN m.new_id IS NOT NULL
                    THEN jsonb_set(r.item, '{templateId}', to_jsonb(m.new_id))
                    ELSE r.item
                  END
                  ORDER BY r.ord
                ),
                '[]'::jsonb)
              INTO new_rows
              FROM jsonb_array_elements(sec->'rows') WITH ORDINALITY AS r(item, ord)
              LEFT JOIN _tpl_split m
                ON jsonb_typeof(r.item) = 'object'
               AND m.old_id = r.item->>'templateId'
               AND CASE
                 WHEN (r.item->>'diameterFeet') ~ num_re
                 THEN abs((r.item->>'diameterFeet')::numeric - m.dia) < 0.005
                 ELSE false
               END;
              doc := jsonb_set(doc, '{circular,rows}', new_rows);
            END IF;

            IF doc IS DISTINCT FROM dr."draftJson"::jsonb THEN
              UPDATE "OneOffDraft" SET "draftJson" = doc::text WHERE id = dr.id;
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Quick Build draft % left as is: %', dr.id, SQLERRM;
        END;
      END LOOP;
    END IF;

    -- -----------------------------------------------------------------
    -- 2. Rectangular: a structure matches its template's slabs and size.
    -- -----------------------------------------------------------------
    CREATE TEMP TABLE _rect_tpl ON COMMIT DROP AS
    SELECT
      st.id,
      st.name,
      (st."topSlabThicknessInches" > 0) AS has_top,
      (st."baseSlabThicknessInches" > 0) AS has_base,
      (SELECT count(*) FROM "StructureTemplateRectSize" z
        WHERE z."templateId" = st.id) AS size_count,
      (SELECT z."insideLengthInches" FROM "StructureTemplateRectSize" z
        WHERE z."templateId" = st.id ORDER BY z."sortOrder", z.id LIMIT 1) AS len,
      (SELECT z."insideWidthInches" FROM "StructureTemplateRectSize" z
        WHERE z."templateId" = st.id ORDER BY z."sortOrder", z.id LIMIT 1) AS wid
    FROM "StructureTemplate" st
    WHERE st.shape = 'RECTANGULAR';

    -- What each saved structure is: a slab only counts when the template has
    -- it, and the size only counts when the template has exactly one size.
    CREATE TEMP TABLE _rect_need ON COMMIT DROP AS
    SELECT
      s.id AS structure_id,
      rt.id AS old_id,
      (rt.has_top AND coalesce(dm."hasTopSlab", true)) AS has_top,
      (rt.has_base AND coalesce(dm."hasBaseSlab", true)) AS has_base,
      CASE
        WHEN rt.size_count = 1
          AND c."insideLengthFeet" > 0 AND c."insideWidthFeet" > 0
        THEN round(c."insideLengthFeet" * 12)::int
        ELSE rt.len
      END AS len,
      CASE
        WHEN rt.size_count = 1
          AND c."insideLengthFeet" > 0 AND c."insideWidthFeet" > 0
        THEN round(c."insideWidthFeet" * 12)::int
        ELSE rt.wid
      END AS wid
    FROM "JobStructure" s
    JOIN _rect_tpl rt ON rt.id = s."structureTemplateId"
    LEFT JOIN "JobStructureDimension" dm ON dm."jobStructureId" = s.id
    LEFT JOIN "JobStructureCalc" c ON c."jobStructureId" = s.id;

    -- Open quote lines (not yet a structure) carry their own slab choice.
    CREATE TEMP TABLE _rect_qneed ON COMMIT DROP AS
    SELECT
      q.id AS line_id,
      rt.id AS old_id,
      (rt.has_top
        AND coalesce(q."structureConfigJson"->>'hasTopSlab', 'true') <> 'false') AS has_top,
      (rt.has_base
        AND coalesce(q."structureConfigJson"->>'hasBaseSlab', 'true') <> 'false') AS has_base,
      rt.len,
      rt.wid
    FROM "QuoteLineItem" q
    JOIN _rect_tpl rt ON rt.id = q."structureConfigJson"->>'templateId'
    WHERE jsonb_typeof(q."structureConfigJson") = 'object'
      AND q."structureConfigJson"->>'shape' = 'RECTANGULAR'
      AND q."jobStructureId" IS NULL;

    FOR v IN
      SELECT DISTINCT
        x.old_id, x.has_top, x.has_base, x.len, x.wid,
        rt.name AS tpl_name, rt.has_top AS tpl_top, rt.has_base AS tpl_base,
        rt.len AS tpl_len, rt.wid AS tpl_wid
      FROM (
        SELECT old_id, has_top, has_base, len, wid FROM _rect_need
        UNION ALL
        SELECT old_id, has_top, has_base, len, wid FROM _rect_qneed
      ) x
      JOIN _rect_tpl rt ON rt.id = x.old_id
      WHERE x.has_top <> rt.has_top
         OR x.has_base <> rt.has_base
         OR x.len IS DISTINCT FROM rt.len
         OR x.wid IS DISTINCT FROM rt.wid
      ORDER BY rt.name, x.len, x.wid, x.has_top DESC, x.has_base DESC
    LOOP
      suffix := '';
      IF v.len IS DISTINCT FROM v.tpl_len OR v.wid IS DISTINCT FROM v.tpl_wid THEN
        -- 48 -> 4', 54 -> 4'-6"
        suffix := ' - '
          || (v.len / 12) || ''''
          || CASE WHEN v.len % 12 <> 0 THEN '-' || (v.len % 12) || '"' ELSE '' END
          || ' x '
          || (v.wid / 12) || ''''
          || CASE WHEN v.wid % 12 <> 0 THEN '-' || (v.wid % 12) || '"' ELSE '' END;
      END IF;
      IF v.has_top <> v.tpl_top AND v.has_base <> v.tpl_base THEN
        suffix := suffix || ' - No Top or Base Slab';
      ELSIF v.has_top <> v.tpl_top THEN
        suffix := suffix || ' - No Top Slab';
      ELSIF v.has_base <> v.tpl_base THEN
        suffix := suffix || ' - No Base Slab';
      END IF;

      base_name := v.tpl_name || suffix;
      new_name := base_name;
      k := 1;
      WHILE EXISTS (SELECT 1 FROM "StructureTemplate" s WHERE s.name = new_name) LOOP
        k := k + 1;
        new_name := base_name || ' (' || k || ')';
      END LOOP;

      new_id := 'c' || substr(
        md5(random()::text || clock_timestamp()::text || new_name), 1, 24);
      INSERT INTO "StructureTemplate" (
        id, name, "agencyStandard", shape, status, notes, "createdAt",
        "updatedAt", "baseSlabThicknessInches", "castingProductId",
        "connectionType", "minimumBrickInches",
        "openingToJointMinBottomInches", "openingToJointMinTopInches",
        "sumpFixedInches", "sumpMode", "topSlabThicknessInches",
        "wallThicknessInches", "rectMinPricingHeightFeet", "rectPdfSetId",
        "topSlabOpeningInches", "rectTopSlabOpeningLengthInches",
        "rectTopSlabOpeningWidthInches", "rectTopSlabOpeningSide"
      )
      SELECT
        new_id, new_name, "agencyStandard", shape, status, notes,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        CASE WHEN v.has_base THEN "baseSlabThicknessInches" ELSE 0 END,
        "castingProductId", "connectionType", "minimumBrickInches",
        "openingToJointMinBottomInches", "openingToJointMinTopInches",
        "sumpFixedInches", "sumpMode",
        CASE WHEN v.has_top THEN "topSlabThicknessInches" ELSE 0 END,
        "wallThicknessInches", "rectMinPricingHeightFeet", "rectPdfSetId",
        "topSlabOpeningInches", "rectTopSlabOpeningLengthInches",
        "rectTopSlabOpeningWidthInches", "rectTopSlabOpeningSide"
      FROM "StructureTemplate" WHERE id = v.old_id;

      IF v.len IS NOT NULL AND v.wid IS NOT NULL THEN
        INSERT INTO "StructureTemplateRectSize" (
          id, "templateId", "insideLengthInches", "insideWidthInches",
          "sortOrder", "createdAt", "updatedAt"
        ) VALUES (
          'c' || substr(md5(random()::text || clock_timestamp()::text || new_id), 1, 24),
          new_id, v.len, v.wid, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
      ELSE
        -- Legacy template without one size: the copy keeps what it had.
        INSERT INTO "StructureTemplateRectSize" (
          id, "templateId", "insideLengthInches", "insideWidthInches",
          "sortOrder", "createdAt", "updatedAt"
        )
        SELECT
          'c' || substr(md5(random()::text || clock_timestamp()::text || z.id), 1, 24),
          new_id, z."insideLengthInches", z."insideWidthInches",
          z."sortOrder", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "StructureTemplateRectSize" z WHERE z."templateId" = v.old_id;
      END IF;

      -- Same prices on every price list.
      INSERT INTO "RectTemplatePriceListEntry" (
        id, "priceListId", "templateId", "wallPricePerFoot", "topSlabPrice",
        "baseSlabPrice", "createdAt", "updatedAt"
      )
      SELECT
        'c' || substr(md5(random()::text || clock_timestamp()::text || e.id), 1, 24),
        e."priceListId", new_id, e."wallPricePerFoot", e."topSlabPrice",
        e."baseSlabPrice", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "RectTemplatePriceListEntry" e WHERE e."templateId" = v.old_id;

      INSERT INTO _tpl_variant VALUES (
        v.old_id, v.has_top, v.has_base, v.len, v.wid, new_id, new_name);
      variant_count := variant_count + 1;
    END LOOP;

    IF EXISTS (SELECT 1 FROM _tpl_variant) THEN
      UPDATE "JobStructure" s
      SET "structureTemplateId" = tv.new_id
      FROM _rect_need rn
      JOIN _tpl_variant tv
        ON tv.old_id = rn.old_id
       AND tv.has_top = rn.has_top
       AND tv.has_base = rn.has_base
       AND tv.len IS NOT DISTINCT FROM rn.len
       AND tv.wid IS NOT DISTINCT FROM rn.wid
      WHERE s.id = rn.structure_id;

      -- A quote line tied to a moved structure follows it.
      UPDATE "QuoteLineItem" q
      SET "structureConfigJson" = jsonb_set(
        jsonb_set(q."structureConfigJson", '{templateId}', to_jsonb(tv.new_id)),
        '{templateName}', to_jsonb(tv.new_name))
      FROM _rect_need rn
      JOIN _tpl_variant tv
        ON tv.old_id = rn.old_id
       AND tv.has_top = rn.has_top
       AND tv.has_base = rn.has_base
       AND tv.len IS NOT DISTINCT FROM rn.len
       AND tv.wid IS NOT DISTINCT FROM rn.wid
      WHERE q."jobStructureId" = rn.structure_id
        AND jsonb_typeof(q."structureConfigJson") = 'object'
        AND q."structureConfigJson"->>'templateId' = rn.old_id;

      -- Open quote lines move by their own slab choice.
      UPDATE "QuoteLineItem" q
      SET "structureConfigJson" = jsonb_set(
        jsonb_set(q."structureConfigJson", '{templateId}', to_jsonb(tv.new_id)),
        '{templateName}', to_jsonb(tv.new_name))
      FROM _rect_qneed qn
      JOIN _tpl_variant tv
        ON tv.old_id = qn.old_id
       AND tv.has_top = qn.has_top
       AND tv.has_base = qn.has_base
       AND tv.len IS NOT DISTINCT FROM qn.len
       AND tv.wid IS NOT DISTINCT FROM qn.wid
      WHERE q.id = qn.line_id;
    END IF;

    RAISE NOTICE 'Template restructure: % round template(s) added by splitting, % rectangular variant template(s) added.',
      split_count, variant_count;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Template restructure data conversion was skipped and rolled back: %', SQLERRM;
  END;
END $$;
