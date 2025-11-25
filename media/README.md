# Media Directory

This directory stores uploaded media files managed by Payload CMS.

## Important Notes

- **Do not manually add files here** - All media should be uploaded through Payload CMS or created via the seed script
- **Files are auto-generated** - When running the seed script with `PAYLOAD_DROP_DATABASE=true`, all files in this directory will become orphaned and can be safely deleted
- **Seed script fetches from remote URLs:**
  - Class images: https://picsum.photos/800/600 (random placeholder images)
  - Instructor avatars: https://avatar.iran.liara.run/public/girl and /public/boy (random avatars)

## Cleaning Up

If you want to start fresh:

```bash
# Remove all media files (keep README)
rm *.jpg *.png *.jpeg

# Re-seed the database (will fetch fresh images)
PAYLOAD_DROP_DATABASE=true pnpm seed
```

Payload will automatically regenerate the necessary files when they're requested.
