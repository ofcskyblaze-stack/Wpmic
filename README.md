# WhatsApp Mic License Server (Render)

## Deploy
1. Push this folder to a new GitHub repository.
2. In Render choose **New + → Blueprint**, select the repo, and apply `render.yaml`.
3. Wait for the service URL, e.g. `https://your-service.onrender.com`. In Render Environment, copy the generated `ADMIN_SECRET` value.
4. Edit the extension's `license-config.js` and replace `https://YOUR-RENDER-SERVICE.onrender.com` with your real URL. Reload the unpacked extension.
5. Open `https://your-service.onrender.com/admin.html`, enter the service URL and `ADMIN_SECRET`, create license keys, and share a key with each user.

## Admin actions
- Create key: choose days (0 = lifetime).
- Block/Unblock: revoke or restore access.
- Unbind device: allow activation on a different device.

## Important hosting note
This starter stores licenses in a JSON file. Render Free services have an ephemeral filesystem; data can reset on redeploy/restart. For reliable long-term use, attach a persistent disk (paid Render feature) or replace storage with a managed database before issuing permanent customer licenses. Free instances may sleep, so revocation takes effect when the extension can reach the service; an already-open session can take up to about 2 minutes to fail closed after connectivity is lost. This does not erase or corrupt a user's downloaded files.
