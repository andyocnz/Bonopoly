/**
 * BONOPOLY - Google Apps Script (SIMPLIFIED)
 * Purpose: Database ONLY - Read/Write Google Sheets
 * React handles: Authentication, Calculations, Business Logic
 */

// ============================================
// WEB APP ENTRY POINTS
// ============================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = e.parameter || {};
    const action = params.action;

    let result;

    switch(action) {
      case 'test':
        result = { success: true, message: 'Database connected' };
        break;

      case 'read':
        result = readSheet(params.sheet, params.filters);
        break;

      case 'write':
        result = writeSheet(params.sheet, params.data);
        break;

      case 'update':
        result = updateSheet(params.sheet, params.filters, params.data);
        break;

      default:
        result = { success: false, error: 'Unknown action' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================
// DATABASE OPERATIONS (SIMPLE)
// ============================================

/**
 * Read from sheet
 * Example: ?action=read&sheet=Game&filters={"game_code":"TESTGM"}
 */
function readSheet(sheetName, filtersJson) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, error: 'Sheet not found: ' + sheetName };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // Parse filters
    const filters = filtersJson ? JSON.parse(filtersJson) : {};

    // Convert to objects and filter
    let results = rows.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        obj[header] = row[i];
      });
      return obj;
    });

    // Apply filters
    Object.keys(filters).forEach(key => {
      results = results.filter(row => row[key] == filters[key]);
    });

    return { success: true, data: results };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Write to sheet (append new row)
 * Example: ?action=write&sheet=Decisions&data={"game_id":1,"team_id":1,...}
 */
function writeSheet(sheetName, dataJson) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, error: 'Sheet not found: ' + sheetName };
    }

    const data = JSON.parse(dataJson);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Build row from data object
    const row = headers.map(header => data[header] || '');

    // Append row
    sheet.appendRow(row);

    return { success: true, message: 'Row added' };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Update existing row
 * Example: ?action=update&sheet=Outputs&filters={"game_id":1,"team_id":1,"round":1}&data={"output_json":"{...}"}
 */
function updateSheet(sheetName, filtersJson, dataJson) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      return { success: false, error: 'Sheet not found: ' + sheetName };
    }

    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const filters = JSON.parse(filtersJson);
    const updateData = JSON.parse(dataJson);

    // Find row to update
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      let match = true;

      // Check if row matches filters
      Object.keys(filters).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (row[colIndex] != filters[key]) {
          match = false;
        }
      });

      if (match) {
        // Update this row
        Object.keys(updateData).forEach(key => {
          const colIndex = headers.indexOf(key);
          if (colIndex >= 0) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updateData[key]);
          }
        });

        return { success: true, message: 'Row updated' };
      }
    }

    return { success: false, error: 'No matching row found' };

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
