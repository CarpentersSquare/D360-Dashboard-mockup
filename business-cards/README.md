# Digital business cards

Dial360 digital business cards. Each person gets a folder with two pages:

- `index.html`: the card (name, title, tagline, QR code, contact details). Show it on your phone for people to scan.
- `form.html`: the page the QR code is meant to open, with the HubSpot contact form embedded.

## Jack Butler

- Folder: `jack-butler/`
- HubSpot form: portal 148369146 (EU), form `d93bd252-6173-407d-9ec4-eda840d4308a`
- The QR code currently opens the HubSpot share link for that form. Once `form.html` is hosted at a public URL, change `formUrl` in the `CARD` settings at the bottom of `jack-butler/index.html` to that URL.

To edit the card details, change the `CARD` object in `index.html`. The logo is loaded from https://dial360.ai/logo.png.
