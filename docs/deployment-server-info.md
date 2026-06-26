# Deployment server info checklist

Fill this out **before** running the deploy scripts on your Windows server. Keep a copy in your internal IT notes (do not commit completed values with real passwords to git).

## Server


| Item                                                | Your value                                    |
| --------------------------------------------------- | --------------------------------------------- |
| Hostname                                            | LIP-TITAN                                     |
| Windows version (Server 2019/2022 or Win 10/11 Pro) | Server 2019                                   |
| Static IP or DHCP reservation                       | **Static** — `192.168.1.20` on Embedded NIC 1 |
| RAM                                                 | 256 GB                                        |
| Free disk on C:                                     | 1.3 TB                                        |
| App install path (default `C:\Apps\precastapp`)     |                                               |


## Network


| Item                                               | Your value                                           |
| -------------------------------------------------- | ---------------------------------------------------- |
| Office subnet (e.g. `192.168.1.0/24`)              | 192.168.1.0/24                                       |
| App URL for staff (e.g. `http://precast-srv:3000`) | [http://192.168.1.20:3000](http://192.168.1.20:3000) |
| VPN used for remote access? (yes/no)               |                                                      |


## Electron client


| Item                                                             | Your value |
| ---------------------------------------------------------------- | ---------- |
| Server URL for Electron clients (e.g. `http://precast-srv:3000`) |            |
| Installer build machine (dev PC or app server)                   |            |
| Client install method (manual / GPO / RMM)                       |            |
| Number of staff PCs                                              |            |


## File shares (UNC)


| Item                                                                     | Your value |
| ------------------------------------------------------------------------ | ---------- |
| Jobs root UNC (e.g. `\\FILESERVER\PrecastJobs`)                          |            |
| Stock submittals root UNC                                                |            |
| Quote PDF fallback dir on server (e.g. `C:\PrecastGeneratedPDFs\Quotes`) |            |
| Service account username (e.g. `DOMAIN\svc-precastapp`)                  |            |
| Service account has read/write on both shares? (yes/no)                  |            |


## Database


| Item                                             | Your value |
| ------------------------------------------------ | ---------- |
| Migration choice: **fresh** or **copy from dev** |            |
| PostgreSQL superuser or dedicated DB user        |            |
| Database name (`precastapp`)                     |            |


## Users and security


| Item                                                              | Your value |
| ----------------------------------------------------------------- | ---------- |
| Staff usernames and roles (attach separate list)                  |            |
| OK with username-only login on LAN until passwords ship? (yes/no) |            |
| `SETTINGS_RESET_PASSWORD` set in `.env`? (yes/no)                 |            |


## PDF generation


| Item                                                | Your value |
| --------------------------------------------------- | ---------- |
| Brave or Chrome installed on server?                |            |
| Fallback: run `npm run puppeteer:install` if needed |            |


## Post-deploy verification

- [ ] `http://SERVERNAME:3000/login` loads from a test PC on LAN (admin smoke test)
- [ ] Precast Ops desktop app installed on a test PC and login works
- [ ] Settings → Files & Folders → Test write access passes for jobs root
- [ ] Settings → Files & Folders → Test write access passes for stock submittals
- [ ] Generate a quote PDF successfully
- [ ] Windows service starts automatically after reboot
- [ ] Scheduled database backup configured