
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

function getPublicGroups(spreadsheet) {
  spreadsheet = spreadsheet || getSpreadsheet();
  const sheet = getRequiredSheet(spreadsheet, "Groups");
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return [];

  const membersByGroupCode = getStudentsByGroupCode(spreadsheet);
  const headers = data[0].map(function(header) {
    return String(header).trim();
  });
  const groupCodeIndex = headers.indexOf("GroupCode");
  const linkColumns = {};
  const resourceHeaders = ["ProposalLink", "PitchVideoLink", "PosterLink"];
  const resourceIndexes = resourceHeaders.map(function(header) {
    return headers.indexOf(header);
  }).filter(function(columnIndex) {
    return columnIndex >= 0;
  });
  let resourceRichText = [];
  let resourceFormulas = [];
  let resourceStartColumn = 0;

  if (resourceIndexes.length > 0) {
    resourceStartColumn = Math.min.apply(null, resourceIndexes);
    const resourceEndColumn = Math.max.apply(null, resourceIndexes);
    const resourceRange = sheet.getRange(
      2,
      resourceStartColumn + 1,
      data.length - 1,
      resourceEndColumn - resourceStartColumn + 1
    );
    resourceRichText = resourceRange.getRichTextValues();
    resourceFormulas = resourceRange.getFormulas();
  }

  resourceHeaders.forEach(function(header) {
    const columnIndex = headers.indexOf(header);
    linkColumns[header] = columnIndex < 0
      ? []
      : getSheetResourceLinks(
        resourceRichText,
        resourceFormulas,
        columnIndex - resourceStartColumn,
        data.slice(1).map(function(row) {
          return row[columnIndex];
        })
      );
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

function getSheetResourceLinks(richTextValues, formulas, columnIndex, values) {
  return values.map(function(value, index) {
    const richText = richTextValues[index][columnIndex];
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

    const formula = formulas[index][columnIndex];
    const formulaMatch = formula && formula.match(/^\s*=\s*HYPERLINK\s*\(\s*"((?:[^"]|"")*)"/i);
    if (formulaMatch) return formulaMatch[1].replace(/""/g, '"');

    return String(value || "").trim();
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

    if (
      action === "getMyEvaluations" ||
      action === "getEvaluations" ||
      action === "getStudentEvaluationData" ||
      action === "getEvaluationStatus" ||
      action === "getEvaluationEligibility"
    ) {
      const student = getAuthenticatedStudent(
        spreadsheet,
        e.parameter.sessionToken
      );
      const evaluations = getEvaluationRows(
        getRequiredSheet(spreadsheet, "Evaluations")
      ).filter(function(evaluation) {
        return String(evaluation.StudentID || "").trim() === student.studentId;
      });
      const groups = action === "getEvaluationEligibility"
        ? getGroupCodes(spreadsheet)
        : null;

      if (action === "getStudentEvaluationData") {
        return responseJSON({
          success: true,
          data: {
            evaluations: evaluations,
            status: getEvaluationStatusData(evaluations.length)
          }
        });
      }

      if (action === "getMyEvaluations" || action === "getEvaluations") {
        return responseJSON({
          success: true,
          data: evaluations
        });
      }

      if (action === "getEvaluationStatus") {
        return responseJSON({
          success: true,
          data: getEvaluationStatusData(evaluations.length)
        });
      }

      return responseJSON({
        success: true,
        data: getEvaluationEligibility(
          student,
          e.parameter.groupCode,
          evaluations,
          groups
        )
      });
    }

    // GET GROUPS / PROJECTS
    if (action === "getGroups" || action === "getProjects") {
      return responseJSON({
        success: true,
        data: getPublicGroups(spreadsheet)
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

          const studentNo = String(getStudentField(u, [
            "student no.",
            "student number",
            "student id"
          ]) || "").trim();

          const studentName = String(getStudentField(u, [
            "name of student",
            "student name",
            "full name",
            "name"
          ]) || "").trim();

          const memberNo = String(getStudentField(u, [
            "member #",
            "member number"
          ]) || "").trim();

          const studentPin = String(getStudentField(u, [
            "pin",
            "password"
          ]) || "").trim();

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
      const studentId = String(getStudentField(user, [
        "student no.",
        "student number",
        "student id",
        "member #",
        "member number"
      ]) || "").trim();
      const sessionToken = createStudentSession(studentId);

      return responseJSON({
        success: true,
        sessionToken: sessionToken,
        user: {
          StudentID: studentId,
          StudentNo: getStudentField(user, [
            "student no.",
            "student number",
            "student id"
          ]),
          FullName: getStudentField(user, [
            "name of student",
            "student name",
            "full name",
            "name"
          ]),
          GroupCode: getStudentField(user, [
            "group code",
            "groupcode"
          ]),
          Program: getStudentField(user, ["program"]),
          Sec: getStudentField(user, ["sec", "section"])
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
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        const student = getAuthenticatedStudent(
          spreadsheet,
          payload.sessionToken
        );
        const requestedGroupCode = String(payload.groupCode || "").trim();
        if (!requestedGroupCode) {
          throw new Error("Group Code is required.");
        }

        const proposalRating = validateRating(payload.proposalRating);
        const pitchVideoRating = validateRating(payload.pitchVideoRating);
        const posterRating = validateRating(payload.posterRating);
        const comment = payload.comment === undefined ? "" : payload.comment;
        if (typeof comment !== "string") {
          throw new Error("Comment must be text.");
        }
        if (comment.trim().length > 500) {
          throw new Error("Comment must be 500 characters or fewer.");
        }

        const groupCode = getGroupCodes(spreadsheet).find(function(candidate) {
          return normalizeGroupCode(candidate) === normalizeGroupCode(requestedGroupCode);
        });
        if (!groupCode) {
          throw new Error("This project group could not be found.");
        }
        if (normalizeGroupCode(student.groupCode) === normalizeGroupCode(groupCode)) {
          throw new Error("You cannot evaluate your own group.");
        }

        const evaluations = getEvaluationRows(evalSheet);
        const mine = evaluations.filter(function(evaluation) {
          return String(evaluation.StudentID || "").trim() === student.studentId;
        });
        if (mine.some(function(evaluation) {
          return normalizeGroupCode(evaluation.GroupCode) === normalizeGroupCode(groupCode);
        })) {
          throw new Error("You have already evaluated this group.");
        }
        if (mine.length >= 5) {
          throw new Error("You have reached the limit of 5 evaluations.");
        }

        const evaluationId = "EV-" + Utilities.getUuid();
        const submittedAt = new Date().toISOString();
        evalSheet.appendRow([
          evaluationId,
          student.studentId,
          groupCode,
          proposalRating,
          pitchVideoRating,
          posterRating,
          comment.trim(),
          submittedAt
        ]);

        return responseJSON({
          success: true,
          evaluationId: evaluationId,
          submittedAt: submittedAt
        });
      } finally {
        lock.releaseLock();
      }
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

const EVALUATION_HEADERS = [
  "EvaluationID",
  "StudentID",
  "GroupCode",
  "ProposalRating",
  "PitchVideoRating",
  "PosterRating",
  "Comment",
  "SubmittedAt"
];

function createStudentSession(studentId) {
  if (!studentId) {
    throw new Error("The authenticated student does not have a StudentID.");
  }
  const sessionToken = Utilities.getUuid();
  CacheService.getScriptCache().put(
    "student-session:" + sessionToken,
    JSON.stringify({ studentId: studentId }),
    21600
  );
  return sessionToken;
}

function getAuthenticatedStudent(spreadsheet, sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) {
    throw new Error("A valid student session is required. Please sign in again.");
  }

  const sessionData = CacheService.getScriptCache().get(
    "student-session:" + token
  );
  if (!sessionData) {
    throw new Error("Your student session has expired. Please sign in again.");
  }

  let session;
  try {
    session = JSON.parse(sessionData);
  } catch (error) {
    throw new Error("Your student session is invalid. Please sign in again.");
  }

  const students = getSheetData(getRequiredSheet(spreadsheet, "Students"));
  const student = students.find(function(record) {
    const id = String(getStudentField(record, [
      "student no.",
      "student number",
      "student id",
      "member #",
      "member number"
    ]) || "").trim();
    return id === session.studentId;
  });
  if (!student) {
    throw new Error("The student account for this session could not be found.");
  }

  return {
    studentId: String(getStudentField(student, [
      "student no.",
      "student number",
      "student id",
      "member #",
      "member number"
    ]) || "").trim(),
    groupCode: String(getStudentField(student, [
      "group code",
      "groupcode"
    ]) || "").trim()
  };
}

function getEvaluationRows(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(header) {
      return String(header).trim();
    })
    : [];
  if (
    headers.length !== EVALUATION_HEADERS.length ||
    !EVALUATION_HEADERS.every(function(header, index) {
      return headers[index] === header;
    })
  ) {
    throw new Error(
      "The Evaluations sheet must use the existing columns in this order: " +
      EVALUATION_HEADERS.join(", ")
    );
  }
  return getSheetData(sheet);
}

function validateRating(value) {
  if (
    typeof value !== "number" ||
    !isFinite(value) ||
    Math.floor(value) !== value ||
    value < 1 ||
    value > 5
  ) {
    throw new Error("Ratings must be whole numbers from 1 to 5.");
  }
  return value;
}

function getEvaluationEligibility(student, groupCode, evaluations, groups) {
  const requestedGroupCode = normalizeGroupCode(groupCode);
  const foundGroup = groups.some(function(candidate) {
    return normalizeGroupCode(candidate) === requestedGroupCode;
  });
  const submitted = evaluations.length;
  const existing = evaluations.some(function(evaluation) {
    return normalizeGroupCode(evaluation.GroupCode) === requestedGroupCode;
  });

  let reason = "";
  let code = "ok";
  if (!foundGroup) {
    code = "missing-group";
    reason = "This project group could not be found.";
  } else if (normalizeGroupCode(student.groupCode) === requestedGroupCode) {
    code = "own-group";
    reason = "You cannot evaluate your own group.";
  } else if (existing) {
    code = "duplicate";
    reason = "You have already evaluated this group.";
  } else if (submitted >= 5) {
    code = "limit";
    reason = "You have reached the limit of 5 evaluations.";
  }

  return {
    canEvaluate: code === "ok",
    code: code,
    reason: reason,
    ...getEvaluationStatusData(submitted)
  };
}

function getGroupCodes(spreadsheet) {
  return getSheetData(getRequiredSheet(spreadsheet, "Groups"))
    .map(function(group) {
      return String(getStudentField(group, ["group code", "groupcode"]) || "").trim();
    })
    .filter(function(groupCode) {
      return Boolean(normalizeGroupCode(groupCode));
    });
}

function getEvaluationStatusData(submitted) {
  return {
    submitted: submitted,
    limit: 5,
    remaining: Math.max(5 - submitted, 0)
  };
}


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
