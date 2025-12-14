# 📊 Bonopoly Google Apps Script (SIMPLIFIED)

## Purpose

**Database layer ONLY** - Read/Write Google Sheets

React handles:
- ✅ Authentication
- ✅ All calculations
- ✅ All business logic
- ✅ Visibility rules (dev mode vs deadline)

## Files

- `Code.gs` - Single file with 3 functions (read, write, update)
- `appsscript.json` - Project config

## API

### Test Connection
```
GET ?action=test
Response: { success: true, message: "Database connected" }
```

### Read Sheet
```
GET ?action=read&sheet=Game&filters={"game_code":"TESTGM"}
Response: { success: true, data: [{...}, {...}] }
```

### Write Sheet (Append)
```
GET ?action=write&sheet=Decisions&data={"game_id":1,"team_id":1,...}
Response: { success: true, message: "Row added" }
```

### Update Sheet
```
GET ?action=update&sheet=Outputs&filters={"game_id":1}&data={"visible":true}
Response: { success: true, message: "Row updated" }
```

## Deployed URL

```
https://script.google.com/macros/s/AKfycbw_qGZbwl9pHyT7_oASmYBWOBpI0yu4OpCajHaV8j-9qw76CJKcAoPhWR5mb33545IP/exec
```

Stored in: `bonopoly-react/src/config/googleSheets.ts`

## Testing

Open: `test-pages/test-simple.html`
