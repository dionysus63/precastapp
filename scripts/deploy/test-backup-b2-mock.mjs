// Stand-in for the Backblaze B2 API, used only by test-backup-script.ps1.
// It answers the five calls the backup makes (sign in, find a bucket, get an
// upload address, upload, list) in the shapes Backblaze documents for
// version 4 of its native API, keeps what it is sent in memory, and listens
// on this PC only (127.0.0.1). Nothing leaves the machine.
//
//   node scripts/deploy/test-backup-b2-mock.mjs --port-file <file>
//
// Key id "test-key-id", key "test-key", bucket "test-bucket".
// POST /__mock/config { restricted, olderAnswer, failUploads, pageSize }
// changes how it behaves; GET /__mock/state shows what it holds.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";

const KEY_ID = "test-key-id";
const KEY = "test-key";
const ACCOUNT_ID = "0001testaccount";
const BUCKET = { bucketId: "bucket-0001", bucketName: "test-bucket" };
// Shaped like the real tokens, which are not valid "Authorization" schemes.
const ACCOUNT_TOKEN = "4_0001testaccount0000000001_01a2b3c4_d5e6f7_acct_tok3n=";
const UPLOAD_TOKEN = "4_0001testaccount0000000001_01a2b3c4_d5e6f7_upld_tok3n=";

const args = process.argv.slice(2);
const portFile = args[args.indexOf("--port-file") + 1];
if (!args.includes("--port-file") || !portFile) {
  console.error("usage: node test-backup-b2-mock.mjs --port-file <file>");
  process.exit(2);
}

const state = {
  // true: the key is limited to the one bucket, as the setup guide asks for.
  restricted: true,
  // true: sign-in answers the way versions 1 and 2 of the API did.
  olderAnswer: false,
  // The next N uploads are refused with a 503, as Backblaze does when busy.
  failUploads: 0,
  // Most files one listing call returns, whatever the caller asks for.
  pageSize: 1000,
  uploads: 0,
  failedUploads: 0,
  /** @type {Map<string, object>} */
  files: new Map(),
};

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json;charset=UTF-8",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
}

function fail(res, status, code, message) {
  send(res, status, { status, code, message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJson(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8") || "{}");
  } catch {
    return null;
  }
}

function listFileNames({ prefix = "", delimiter, startFileName, maxFileCount }) {
  const entries = new Map();
  for (const file of state.files.values()) {
    if (!file.fileName.startsWith(prefix)) continue;
    const rest = file.fileName.slice(prefix.length);
    const cut = delimiter ? rest.indexOf(delimiter) : -1;
    if (cut >= 0) {
      const folder = prefix + rest.slice(0, cut + delimiter.length);
      entries.set(folder, {
        action: "folder",
        fileName: folder,
        fileId: null,
        contentLength: 0,
        contentSha1: null,
        uploadTimestamp: 0,
      });
    } else {
      entries.set(file.fileName, file);
    }
  }
  const sorted = [...entries.values()]
    .sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0))
    .filter((entry) => !startFileName || entry.fileName >= startFileName);
  const asked = Number.isInteger(maxFileCount) && maxFileCount > 0 ? maxFileCount : 100;
  const size = Math.min(asked, state.pageSize);
  return {
    files: sorted.slice(0, size),
    nextFileName: sorted.length > size ? sorted[size].fileName : null,
  };
}

async function handle(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  // Any version number is taken: /b2api/v4/..., /b2api/v2/...
  const path = url.pathname.replace(/^\/b2api\/v\d+\//, "/b2api/");
  const authorization = req.headers.authorization ?? "";

  if (path === "/__mock/config" && req.method === "POST") {
    const config = parseJson(await readBody(req)) ?? {};
    if (typeof config.restricted === "boolean") state.restricted = config.restricted;
    if (typeof config.olderAnswer === "boolean") state.olderAnswer = config.olderAnswer;
    if (Number.isInteger(config.failUploads)) state.failUploads = config.failUploads;
    if (Number.isInteger(config.pageSize)) state.pageSize = config.pageSize;
    return send(res, 200, { ok: true });
  }
  if (path === "/__mock/state" && req.method === "GET") {
    return send(res, 200, {
      uploads: state.uploads,
      failedUploads: state.failedUploads,
      files: [...state.files.values()],
    });
  }

  if (path === "/b2api/b2_authorize_account" && req.method === "GET") {
    const expected = "Basic " + Buffer.from(`${KEY_ID}:${KEY}`).toString("base64");
    if (authorization !== expected) {
      return fail(res, 401, "bad_auth_token", "Invalid applicationKeyId and/or applicationKey");
    }
    const host = `http://127.0.0.1:${server.address().port}`;
    const capabilities = ["listBuckets", "listFiles", "readFiles", "writeFiles"];
    const sizes = { recommendedPartSize: 100000000, absoluteMinimumPartSize: 5000000 };
    if (state.olderAnswer) {
      return send(res, 200, {
        accountId: ACCOUNT_ID,
        authorizationToken: ACCOUNT_TOKEN,
        apiUrl: host,
        downloadUrl: host,
        ...sizes,
        allowed: {
          capabilities,
          bucketId: state.restricted ? BUCKET.bucketId : null,
          bucketName: state.restricted ? BUCKET.bucketName : null,
          namePrefix: null,
        },
      });
    }
    return send(res, 200, {
      accountId: ACCOUNT_ID,
      authorizationToken: ACCOUNT_TOKEN,
      applicationKeyExpirationTimestamp: null,
      apiInfo: {
        storageApi: {
          apiUrl: host,
          downloadUrl: host,
          s3ApiUrl: host,
          ...sizes,
          allowed: {
            capabilities,
            buckets: state.restricted ? [{ id: BUCKET.bucketId, name: BUCKET.bucketName }] : null,
            namePrefix: null,
          },
        },
      },
    });
  }

  if (path.startsWith("/b2api/b2_upload_file/") && req.method === "POST") {
    const body = await readBody(req);
    if (authorization !== UPLOAD_TOKEN) {
      return fail(res, 401, "bad_auth_token", "Invalid upload authorization token");
    }
    // Backblaze takes no chunked uploads: the length has to be stated.
    if (req.headers["content-length"] === undefined) {
      return fail(res, 411, "length_required", "Content-Length is required");
    }
    if (state.failUploads > 0) {
      state.failUploads -= 1;
      state.failedUploads += 1;
      return fail(res, 503, "service_unavailable", "The stand-in is refusing this upload on purpose");
    }
    const sha1 = createHash("sha1").update(body).digest("hex");
    if (req.headers["x-bz-content-sha1"] !== sha1) {
      return fail(res, 400, "bad_request", "Sha1 did not match data received");
    }
    let fileName;
    try {
      fileName = decodeURIComponent(String(req.headers["x-bz-file-name"] ?? ""));
    } catch {
      fileName = "";
    }
    if (!fileName || fileName.startsWith("/") || fileName.includes("//") || fileName.includes("\\")) {
      return fail(res, 400, "bad_request", "File names must not be empty, start with / or contain // or a backslash");
    }
    state.uploads += 1;
    const file = {
      action: "upload",
      fileId: `4_z_f${String(state.uploads).padStart(6, "0")}`,
      fileName,
      contentLength: body.length,
      contentSha1: sha1,
      contentType: req.headers["content-type"] ?? null,
      uploadTimestamp: Date.now(),
    };
    state.files.set(fileName, file);
    return send(res, 200, { accountId: ACCOUNT_ID, bucketId: BUCKET.bucketId, ...file });
  }

  if (path.startsWith("/b2api/") && req.method === "POST") {
    const body = parseJson(await readBody(req));
    if (authorization !== ACCOUNT_TOKEN) {
      return fail(res, 401, "bad_auth_token", "Invalid authorization token");
    }
    if (!body) {
      return fail(res, 400, "bad_json", "The request body is not JSON");
    }
    const operation = path.slice("/b2api/".length);
    if (operation === "b2_list_buckets") {
      const named = !body.bucketName || body.bucketName.toLowerCase() === BUCKET.bucketName;
      return send(res, 200, { buckets: named ? [{ accountId: ACCOUNT_ID, ...BUCKET, bucketType: "allPrivate" }] : [] });
    }
    if (body.bucketId !== BUCKET.bucketId) {
      return fail(res, 400, "bad_bucket_id", `Bucket ${body.bucketId} does not exist`);
    }
    if (operation === "b2_get_upload_url") {
      const host = `http://127.0.0.1:${server.address().port}`;
      return send(res, 200, {
        bucketId: BUCKET.bucketId,
        uploadUrl: `${host}/b2api/v4/b2_upload_file/${BUCKET.bucketId}/c001_v0001`,
        authorizationToken: UPLOAD_TOKEN,
      });
    }
    if (operation === "b2_list_file_names") {
      return send(res, 200, listFileNames(body));
    }
  }

  return fail(res, 404, "not_found", `${req.method} ${path} is not part of this stand-in`);
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    fail(res, 500, "internal_error", String(error?.message ?? error));
  });
});

server.listen(0, "127.0.0.1", () => {
  writeFileSync(portFile, String(server.address().port));
  console.log(`B2 stand-in listening on 127.0.0.1:${server.address().port}`);
});

// A self-check that crashed must not leave this running for good.
setTimeout(() => process.exit(0), 10 * 60 * 1000);
