# Brian Solar & Electrical â€” Python Website Restructure

This is a safe first-pass restructure based on the uploaded GitHub ZIP.

## Run
```powershell
cd brian-solar-python-site
python build.py
```

The generated static website is written to `public/`.

## Architecture
- `data/business.json` â€” single source of truth for business details and services
- `templates/` â€” reusable page templates/components
- `content/` â€” existing blog/location source content
- `static/` â€” shared assets
- `public/` â€” generated website
- `legacy/` â€” untouched copies of the original HTML/CSS/JS for migration/reference

## Core services
Solar, Electrical, CCTV, Electric Fence.

## Next migration
Move the existing page content and current visual design into the new templates, then add:
- About
- Projects
- Locations
- Blog index
- FAQ
- Contact
- Privacy Policy
- Terms of Service
- sitemap.xml
- robots.txt
- structured data/schema
- canonical URLs and redirects
- WhatsApp/contact integration
