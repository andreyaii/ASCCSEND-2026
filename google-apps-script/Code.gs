
/*******************************************************
 * TECHCON 2026 - GOOGLE APPS SCRIPT BACKEND
 *******************************************************/


// =====================================================
// 1. SPREADSHEET CONNECTION TEST
// =====================================================

function testSpreadsheetConnection() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID is missing from Script Properties.");
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);

  const requiredSheets = [
    "Students",
    "Groups",
    "Evaluations",
    "Faculty",
    "EvaluationSettings"
  ];

  const results = [];

  requiredSheets.forEach(function(sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      results.push(sheetName + ": NOT FOUND");
      return;
    }

    const headers = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      : [];

    results.push(
      sheetName + ": FOUND | Columns: " + headers.join(", ")
    );
  });

  Logger.log("Spreadsheet connected: " + spreadsheet.getName());

  results.forEach(function(result) {
    Logger.log(result);
  });
}


// =====================================================
// 2. PUBLIC GROUPS
// =====================================================

function getPublicGroups() {
  const spreadsheet = getSpreadsheet();
  const sheet = getRequiredSheet(spreadsheet, "Groups");
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  const membersByGroupCode = getStudentsByGroupCode(spreadsheet);
  const headers = data[0].map(function(header) {
    return String(header).trim();
  });
  const groupCodeIndex = headers.indexOf("GroupCode");
  const linkColumns = {};

  ["ProposalLink", "PitchVideoLink", "PosterLink"].forEach(function(header) {
    const columnIndex = headers.indexOf(header);
    linkColumns[header] = columnIndex < 0
      ? []
      : getSheetResourceLinks(sheet, columnIndex + 1, data.length - 1);
  });

  return data.slice(1)
    .map(function(row, index) {
      const group = {};
      headers.forEach(function(header, columnIndex) {
        group[header] = row[columnIndex];
      });

      if (groupCodeIndex >= 0) {
        group.GroupCode = String(row[groupCodeIndex] || "").trim();
      }

      group.ProposalLink = linkColumns.ProposalLink[index] || group.ProposalLink;
      group.PitchVideoLink = linkColumns.PitchVideoLink[index] || group.PitchVideoLink;
      group.PosterLink = linkColumns.PosterLink[index] || group.PosterLink;
      return group;
    })
    .filter(function(group) {
      return String(group.GroupCode || "").trim() !== "";
    })
    .map(function(group) {
      return {
        groupCode: group.GroupCode,
        title: group.Title,
        description: group.Description,
        tag: group.Tag,
        stage: group.Stage,

        // Actual spreadsheet column: Adviser
        // Keep facultyId as the API property for compatibility.
        facultyId: group.Adviser,

        thumbnail: group.Thumbnail,
        proposalLink: group.ProposalLink,
        pitchVideoLink: group.PitchVideoLink,
        members: membersByGroupCode[normalizeGroupCode(group.GroupCode)] || [],

        // Actual spreadsheet column: PosterLink
        // Keep documentationLink as the API property for compatibility.
        documentationLink: group.PosterLink
      };
    });
}

function getStudentsByGroupCode(spreadsheet) {
  const sheet = getRequiredSheet(spreadsheet, "Students");
  const students = getSheetData(sheet);
  const membersByGroupCode = {};

  students.forEach(function(student) {
    const groupCode = normalizeGroupCode(
      getStudentField(student, ["group code", "groupcode"])
    );
    const studentId = String(getStudentField(student, [
      "student no.",
      "student number",
      "student id",
      "member #",
      "member number"
    ]) || "").trim();
    const name = String(getStudentField(student, [
      "name of student",
      "student name",
      "full name",
      "name"
    ]) || "").trim();

    if (!groupCode || !name) return;

    if (!membersByGroupCode[groupCode]) {
      membersByGroupCode[groupCode] = [];
    }

    membersByGroupCode[groupCode].push({
      id: studentId || name,
      studentId: studentId,
      name: name
    });
  });

  return membersByGroupCode;
}

function getStudentField(student, aliases) {
  const normalizedAliases = aliases.map(normalizeHeader);
  const header = Object.keys(student).find(function(key) {
    return normalizedAliases.indexOf(normalizeHeader(key)) !== -1;
  });
  return header ? student[header] : "";
}

function normalizeHeader(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeGroupCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toUpperCase();
}

function getSheetResourceLinks(sheet, column, rowCount) {
  if (rowCount <= 0) return [];

  const range = sheet.getRange(2, column, rowCount, 1);
  const richTextValues = range.getRichTextValues();
  const formulas = range.getFormulas();
  const values = range.getValues();

  return values.map(function(row, index) {
    const richText = richTextValues[index][0];
    const directLink = richText && richText.getLinkUrl();
    if (directLink) return directLink;

    if (richText) {
      const runLinks = richText.getRuns()
        .map(function(run) {
          return run.getLinkUrl();
        })
        .filter(function(url) {
          return Boolean(url);
        });
      if (runLinks.length === 1) return runLinks[0];
    }

    const formula = formulas[index][0];
    const formulaMatch = formula && formula.match(/^\s*=\s*HYPERLINK\s*\(\s*"((?:[^"]|"")*)"/i);
    if (formulaMatch) return formulaMatch[1].replace(/""/g, '"');

    return String(row[0] || "").trim();
  });
}


// =====================================================
// 3. GET REQUEST HANDLER
// =====================================================

function doGet(e) {
  try {
    const action = e && e.parameter
      ? e.parameter.action
      : "";

    const spreadsheet = getSpreadsheet();

    // GET GROUPS / PROJECTS
    if (action === "getGroups" || action === "getProjects") {
      return responseJSON({
        success: true,
        data: getPublicGroups()
      });
    }

    // GET EVALUATION SETTINGS
    if (action === "getSettings") {
      const sheet = getRequiredSheet(
        spreadsheet,
        "EvaluationSettings"
      );

      const rows = getSheetData(sheet);
      const settings = {};

      rows.forEach(function(row) {
        const setting = String(row.Setting || "").trim();

        if (setting !== "") {
          settings[setting] = row.Value;
        }
      });

      return responseJSON({
        success: true,
        data: settings
      });
    }

    // GET EVALUATIONS
    if (action === "getEvaluations") {
      const sheet = getRequiredSheet(
        spreadsheet,
        "Evaluations"
      );

      return responseJSON({
        success: true,
        data: getSheetData(sheet)
      });
    }

    return responseJSON({
      success: false,
      message: "Invalid GET action: " + action
    });

  } catch (error) {
    Logger.log("GET Error: " + error.message);

    return responseJSON({
      success: false,
      message: error.message
    });
  }
}


// =====================================================
// 4. POST REQUEST HANDLER
// =====================================================

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No POST data received.");
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    const spreadsheet = getSpreadsheet();


    // -------------------------------------------------
    // A. STUDENT / FACULTY / ADMIN LOGIN
    // -------------------------------------------------

    if (action === "login") {
      const identifier = String(payload.identifier || "").trim();
      const password = String(payload.password || "").trim();
      const role = String(payload.role || "").trim();

      if (!identifier || !password || !role) {
        throw new Error("Please provide your login credentials and role.");
      }

      const isFacultyOrAdmin =
        role.toLowerCase() === "faculty" ||
        role.toLowerCase() === "admin";

      if (
        !isFacultyOrAdmin &&
        role.toLowerCase() !== "student"
      ) {
        throw new Error("Invalid login role.");
      }

      const sheetName = isFacultyOrAdmin
        ? "Faculty"
        : "Students";

      const sheet = getRequiredSheet(spreadsheet, sheetName);
      const users = getSheetData(sheet);

      const user = users.find(function(u) {
        if (isFacultyOrAdmin) {

          // FACULTY / ADMIN LOGIN
          // Uses ONLY FacultyID and Password.

          const facultyId = String(
            u.FacultyID || ""
          ).trim();

          const facultyPassword = String(
            u.Password || ""
          ).trim();

          const facultyRole = normalizeFacultyRole(u.Role);

          const matchesCredentials =
            facultyId === identifier &&
            facultyPassword === password;

          const matchesRole = role.toLowerCase() === "faculty"
            ? ["faculty", "adviser", "admin"].indexOf(facultyRole) !== -1
            : facultyRole === role.toLowerCase();

          return matchesCredentials && matchesRole;

        } else {

          // STUDENT LOGIN
          // Uses the exact spreadsheet column headers.

          const studentNo = String(
            u["STUDENT NO."] || ""
          ).trim();

          const studentName = String(
            u["NAME OF STUDENT"] || ""
          ).trim();

          const memberNo = String(
            u["MEMBER #"] || ""
          ).trim();

          const studentPin = String(
            u["PIN"] || ""
          ).trim();

          const matchesIdentifier =
            studentNo === identifier ||
            studentName === identifier ||
            memberNo === identifier;

          const matchesPassword =
            studentPin === password;

          return matchesIdentifier && matchesPassword;
        }
      });

      if (!user) {
        return responseJSON({
          success: false,
          message: "Invalid ID or Password for " + role + "."
        });
      }

      // FACULTY / ADMIN USER RESPONSE
      if (isFacultyOrAdmin) {
        return responseJSON({
          success: true,
          user: {
            FacultyID: user.FacultyID,
            FullName: user.FullName,
            Role: user.Role
          },
          role: normalizeFacultyRole(user.Role)
        });
      }

      // STUDENT USER RESPONSE
      return responseJSON({
        success: true,
        user: {
          StudentID: user["STUDENT NO."] || user["MEMBER #"],
          StudentNo: user["STUDENT NO."],
          FullName: user["NAME OF STUDENT"],
          GroupCode: user["GROUP CODE"],
          Program: user["PROGRAM"],
          Sec: user["SEC"]
        },
        role: "student"
      });
    }


    // -------------------------------------------------
    // B. SUBMIT PEER EVALUATION
    // -------------------------------------------------

    if (action === "submitEvaluation") {
      const evalSheet = getRequiredSheet(
        spreadsheet,
        "Evaluations"
      );

      const studentId = String(
        payload.studentId || ""
      ).trim();

      const groupCode = String(
        payload.groupCode || ""
      ).trim();

      if (!studentId || !groupCode) {
        throw new Error("Student ID and Group Code are required.");
      }

      const proposalRating = payload.proposalRating;
      const pitchVideoRating = payload.pitchVideoRating;

      // Accept both names for compatibility with the
      // existing frontend. Store the value under PosterRating.
      const posterRating = payload.posterRating !== undefined
        ? payload.posterRating
        : payload.documentationRating;

      if (
        proposalRating === undefined ||
        pitchVideoRating === undefined ||
        posterRating === undefined
      ) {
        throw new Error("All evaluation ratings are required.");
      }

      const evaluationId =
        "EV-" + new Date().getTime();

      // Column order follows the Evaluations sheet exactly.
      evalSheet.appendRow([
        evaluationId,
        studentId,
        groupCode,
        proposalRating,
        pitchVideoRating,
        posterRating,
        payload.comment || "",
        new Date().toISOString()
      ]);

      return responseJSON({
        success: true,
        evaluationId: evaluationId
      });
    }


    // -------------------------------------------------
    // C. UPDATE EVALUATION SETTINGS
    // -------------------------------------------------

    if (action === "updateSettings") {
      const settingsSheet = getRequiredSheet(
        spreadsheet,
        "EvaluationSettings"
      );

      const setting = String(
        payload.setting || ""
      ).trim();

      if (!setting) {
        throw new Error("Setting name is required.");
      }

      const data = settingsSheet.getDataRange().getValues();

      let settingFound = false;

      for (let i = 1; i < data.length; i++) {
        if (
          String(data[i][0]).trim() === setting
        ) {
          settingsSheet.getRange(i + 1, 2).setValue(
            payload.value
          );

          settingFound = true;
          break;
        }
      }

      if (!settingFound) {
        throw new Error("Setting not found: " + setting);
      }

      return responseJSON({
        success: true,
        message: "Evaluation setting updated successfully."
      });
    }


    // -------------------------------------------------
    // INVALID POST ACTION
    // -------------------------------------------------

    return responseJSON({
      success: false,
      message: "Invalid POST action: " + action
    });

  } catch (error) {
    Logger.log("POST Error: " + error.message);

    return responseJSON({
      success: false,
      message: error.message
    });
  }
}


// =====================================================
// 5. HELPER FUNCTIONS
// =====================================================


// Get spreadsheet using Script Properties.
function getSpreadsheet() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty("SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error(
      "SPREADSHEET_ID is missing from Script Properties."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);
}


// Get required sheet and validate its existence.
function getRequiredSheet(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      sheetName + " sheet not found."
    );
  }

  return sheet;
}

function normalizeFacultyRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/^faculty[\s_-]+/, "");
}


// Convert spreadsheet rows into JavaScript objects.
function getSheetData(sheet) {
  if (!sheet) {
    throw new Error("Cannot read data from a missing sheet.");
  }

  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  const headers = data.shift().map(function(header) {
    return String(header).trim();
  });

  return data
    .filter(function(row) {
      return row.some(function(cell) {
        return cell !== "" && cell !== null;
      });
    })
    .map(function(row) {
      const obj = {};

      headers.forEach(function(header, index) {
        obj[header] = row[index];
      });
  
      return obj;
    });
}


// Return JSON response.
function responseJSON(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
