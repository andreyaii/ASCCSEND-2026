
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
  const resourceHeaders = ["ResearchPaperLink", "PitchVideoLink", "PosterLink"];
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

      group.ResearchPaperLink = linkColumns.ResearchPaperLink[index] || group.ResearchPaperLink;
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
        researchPaperLink: group.ResearchPaperLink,
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

    if (action === "getRatingAnalytics") {
      getAuthenticatedAdmin(e.parameter.sessionToken);
      const evalSheet = getRequiredSheet(spreadsheet, "Evaluations");
      return responseJSON({
        success: true,
        data: {
          evaluations: getRatingAnalyticsRows(
            spreadsheet,
            getEvaluationRows(evalSheet)
          )
        }
      });
    }

    if (action === "getFacultyEvaluationData") {
      const evaluator = getAuthenticatedFacultyForEvaluationHistory(
        spreadsheet,
        e.parameter.sessionToken
      );
      const evaluations = getEvaluationRows(
        getRequiredSheet(spreadsheet, "Evaluations")
      ).filter(function(evaluation) {
        return String(evaluation.StudentID || "").trim() === evaluator.facultyId;
      });
      return responseJSON({
        success: true,
        data: { evaluations: evaluations }
      });
    }

    if (
      action === "getMyEvaluations" ||
      action === "getEvaluations" ||
      action === "getEvaluationsForGroup" ||
      action === "getStudentEvaluationData" ||
      action === "getEvaluationStatus" ||
      action === "getEvaluationEligibility"
    ) {
      const evaluator = getAuthenticatedEvaluator(
        spreadsheet,
        e.parameter.sessionToken
      );

      if (evaluator.type === "guest") {
        return responseJSON({
          success: false,
          message: "Guests cannot view or submit evaluations."
        });
      }

      const evalSheet = getRequiredSheet(spreadsheet, "Evaluations");
      const evaluatorId = evaluator.type === "student" ? evaluator.studentId : evaluator.facultyId;
      const allEvaluations = getEvaluationRows(evalSheet);
      const evaluations = allEvaluations.filter(function(evaluation) {
        return String(evaluation.StudentID || "").trim() === evaluatorId;
      });

      if (action === "getEvaluationsForGroup") {
        if (evaluator.type !== "faculty") {
          throw new Error("Only signed-in faculty can view received evaluation details.");
        }
        const groupCode = normalizeGroupCode(e.parameter.groupCode);
        if (!groupCode) {
          throw new Error("Group Code is required.");
        }
        const groupEvaluations = allEvaluations.filter(function(evaluation) {
          return normalizeGroupCode(evaluation.GroupCode) === groupCode;
        });
        return responseJSON({
          success: true,
          data: getRatingAnalyticsRows(spreadsheet, groupEvaluations).map(function(evaluation, index) {
            return {
              ...evaluation,
              Comment: groupEvaluations[index].Comment
            };
          })
        });
      }

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
        const isFacultyAdmin = evaluator.type === "faculty" && evaluator.role === "admin";
        return responseJSON({
          success: true,
          data: isFacultyAdmin ? getEvaluationRows(evalSheet) : evaluations
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
          evaluator,
          e.parameter.groupCode,
          evaluations,
          groups,
          spreadsheet
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
      const requestedRole = String(payload.role || "").trim();

      if (!identifier || !password || !requestedRole) {
        throw new Error("Please provide your login credentials and role.");
      }

      const role = requestedRole.toLowerCase() === "faculty" && identifier.toLowerCase() === "guest"
        ? "Guest"
        : requestedRole;
      const isGuest = role.toLowerCase() === "guest";
      const isFacultyOrAdmin =
        role.toLowerCase() === "faculty" ||
        role.toLowerCase() === "admin";

      if (
        !isFacultyOrAdmin &&
        !isGuest &&
        role.toLowerCase() !== "student"
      ) {
        throw new Error("Invalid login role.");
      }

      // GUEST LOGIN
      if (isGuest) {
        let guestUser = null;
        const guestSheet = spreadsheet.getSheetByName("Guests");
        if (guestSheet) {
          const guests = getSheetData(guestSheet);
          guestUser = guests.find(function(g) {
            const gid = String(g.GuestID || g.ID || g.Email || g.Username || "").trim().toLowerCase();
            const gpass = String(g.Password || "").trim();
            return gid === identifier.toLowerCase() && gpass === password;
          });
        }
        if (!guestUser) {
          const validGuestId = identifier.toLowerCase() === "guest" || identifier.toLowerCase() === "guest@techcon.edu" || identifier.toLowerCase() === "guest-001";
          const validGuestPass = password === "guest" || password === "techcon123" || password === "guest123";
          if (validGuestId && validGuestPass) {
            guestUser = {
              GuestID: "GUEST-001",
              FullName: "Guest User",
              Role: "Guest"
            };
          }
        }
        if (!guestUser) {
          return responseJSON({
            success: false,
            message: "Invalid credentials for Guest. Use guest / guest."
          });
        }
        const sessionToken = createGuestSession(guestUser.GuestID || "GUEST-001");
        return responseJSON({
          success: true,
          sessionToken: sessionToken,
          user: {
            GuestID: guestUser.GuestID || "GUEST-001",
            FullName: guestUser.FullName || "Guest User",
            Role: "Guest"
          },
          role: "guest"
        });
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
        const sessionToken = createFacultySession(user.FacultyID, normalizeFacultyRole(user.Role));
        return responseJSON({
          success: true,
          sessionToken: sessionToken,
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
        const evaluator = getAuthenticatedEvaluator(
          spreadsheet,
          payload.sessionToken
        );
        if (evaluator.type === "guest") {
          throw new Error("Guests cannot evaluate projects.");
        }

        const requestedGroupCode = String(payload.groupCode || "").trim();
        if (!requestedGroupCode) {
          throw new Error("Group Code is required.");
        }

        const researchPaperRating = validateRating(payload.researchPaperRating);
        const pitchVideoRating = validateRating(payload.pitchVideoRating);
        const posterRating = validateRating(payload.posterRating);
        const logoRating = validateRating(payload.logoRating);
        const comment = payload.comment === undefined ? "" : payload.comment;
        if (typeof comment !== "string") {
          throw new Error("Comment must be text.");
        }
        if (comment.trim().length > 500) {
          throw new Error("Comment must be 500 characters or fewer.");
        }

        const groupsSheet = getRequiredSheet(spreadsheet, "Groups");
        const groupsData = getSheetData(groupsSheet);
        const group = groupsData.find(function(candidate) {
          return normalizeGroupCode(candidate.GroupCode) === normalizeGroupCode(requestedGroupCode);
        });
        if (!group) {
          throw new Error("This project group could not be found.");
        }
        const groupCode = group.GroupCode;

        if (evaluator.type === "student") {
          if (normalizeGroupCode(evaluator.groupCode) === normalizeGroupCode(groupCode)) {
            throw new Error("You cannot evaluate your own group.");
          }
        } else if (evaluator.type === "faculty") {
          // Faculty Advisers cannot rate groups assigned to them.
          const adviser = String(group.Adviser || "").trim().toLowerCase();
          const facultyId = String(evaluator.facultyId || "").trim().toLowerCase();
          const facultyName = String(evaluator.fullName || "").trim().toLowerCase();
          if (adviser && (adviser === facultyId || adviser === facultyName)) {
            throw new Error("Faculty advisers cannot evaluate groups assigned to them.");
          }
        }

        const evaluatorId = evaluator.type === "student" ? evaluator.studentId : evaluator.facultyId;
        const evaluations = getEvaluationRows(evalSheet);
        const mine = evaluations.filter(function(evaluation) {
          return String(evaluation.StudentID || "").trim() === evaluatorId;
        });
        if (mine.some(function(evaluation) {
          return normalizeGroupCode(evaluation.GroupCode) === normalizeGroupCode(groupCode);
        })) {
          throw new Error("You have already evaluated this group.");
        }
        const evaluationId = generateEvaluationId(evalSheet);

        const submittedAt = Utilities.formatDate(
          new Date(),
          "Asia/Manila",
          "yyyy-MM-dd HH:mm:ss"
        );
        const evaluation = {
          EvaluationID: evaluationId,
          StudentID: evaluatorId,
          GroupCode: groupCode,
          ResearchPaperRating: researchPaperRating,
          PitchVideoRating: pitchVideoRating,
          PosterRating: posterRating,
          LogoRating: logoRating,
          Comment: comment.trim(),
          SubmittedAt: submittedAt
        };
        evalSheet.appendRow(
          getEvaluationHeaders(evalSheet).map(function(header) {
            return evaluation[header];
          })
        );

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
    // D. UPLOAD PROJECT THUMBNAIL
    // -------------------------------------------------

    if (action === "uploadThumbnail") {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        // Authenticate the student.
        // Never trust a group code supplied by the frontend.
        const student = getAuthenticatedStudent(
          spreadsheet,
          payload.sessionToken
        );

        const groupCode = normalizeGroupCode(student.groupCode);

        if (!groupCode) {
          throw new Error("You are not currently assigned to a group.");
        }

        // Validate the image data.
        const imageData = String(payload.imageData || "");

        const match = imageData.match(
          /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
        );

        if (!match) {
          throw new Error("Please upload a valid JPG, PNG, or WebP image.");
        }

        const mimeType = match[1];
        const base64Data = match[2];
        const imageBytes = Utilities.base64Decode(base64Data);

        // Limit uploads to 2 MB.
        if (imageBytes.length > 2 * 1024 * 1024) {
          throw new Error("Image size must not exceed 2 MB.");
        }

        // Get the dedicated Google Drive folder.
        const folderId = PropertiesService
          .getScriptProperties()
          .getProperty("THUMBNAIL_FOLDER_ID");

        if (!folderId) {
          throw new Error("THUMBNAIL_FOLDER_ID is missing from Script Properties.");
        }

        const folder = DriveApp.getFolderById(folderId);

        const extension = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp"
        }[mimeType];

        // Find the student's group in the Groups sheet before touching Drive,
        // so a missing row cannot leave a new image behind.
        const groupsSheet = getRequiredSheet(spreadsheet, "Groups");
        const values = groupsSheet.getDataRange().getValues();

        const headers = values[0].map(function(header) {
          return String(header).trim();
        });

        const groupCodeIndex = headers.indexOf("GroupCode");
        const thumbnailIndex = headers.indexOf("Thumbnail");

        if (groupCodeIndex < 0 || thumbnailIndex < 0) {
          throw new Error(
            "The Groups sheet must contain GroupCode and Thumbnail columns."
          );
        }

        let targetRow = -1;

        for (let i = 1; i < values.length; i++) {
          if (
            normalizeGroupCode(values[i][groupCodeIndex]) === groupCode
          ) {
            targetRow = i + 1;
            break;
          }
        }

        if (targetRow < 0) {
          throw new Error("Your assigned group could not be found.");
        }

        const thumbnailCell = groupsSheet.getRange(
          targetRow,
          thumbnailIndex + 1
        );
        const existingThumbnailUrl = String(thumbnailCell.getValue() || "").trim();
        // One stable name per group. The Thumbnail column has a single cell,
        // so the folder must keep a single image for that group.
        const fileName = "thumbnail_" + groupCode + "." + extension;
        const blob = Utilities.newBlob(
          imageBytes,
          mimeType,
          fileName
        );
        const file = replaceGroupThumbnailFile(
          folder,
          folderId,
          groupCode,
          existingThumbnailUrl,
          blob,
          fileName
        );

        // Image access is inherited from the preconfigured thumbnail folder.
        // The version parameter changes after each edit so browsers reload the
        // same Drive file instead of showing a cached copy.
        const thumbnailUrl =
          "https://drive.google.com/thumbnail?id=" +
          file.getId() + "&sz=w1200&v=" + new Date().getTime();

        thumbnailCell.setValue(thumbnailUrl);

        return responseJSON({
          success: true,
          message: "Project thumbnail uploaded successfully.",
          thumbnail: thumbnailUrl
        });

      } finally {
        lock.releaseLock();
      }
    }

    if (action === "deleteThumbnail") {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);

      try {
        const student = getAuthenticatedStudent(
          spreadsheet,
          payload.sessionToken
        );
        const groupCode = normalizeGroupCode(student.groupCode);
        if (!groupCode) {
          throw new Error("You are not currently assigned to a group.");
        }

        const groupsSheet = getRequiredSheet(spreadsheet, "Groups");
        const values = groupsSheet.getDataRange().getValues();
        if (values.length < 2) {
          throw new Error("The Groups sheet does not contain any project rows.");
        }
        const headers = values[0].map(function(header) {
          return String(header).trim();
        });
        const groupCodeIndex = headers.indexOf("GroupCode");
        const thumbnailIndex = headers.indexOf("Thumbnail");
        if (groupCodeIndex < 0 || thumbnailIndex < 0) {
          throw new Error(
            "The Groups sheet must contain GroupCode and Thumbnail columns."
          );
        }

        let targetRow = -1;
        for (let i = 1; i < values.length; i++) {
          if (normalizeGroupCode(values[i][groupCodeIndex]) === groupCode) {
            targetRow = i + 1;
            break;
          }
        }
        if (targetRow < 0) {
          throw new Error("Your assigned group could not be found.");
        }

        const thumbnailCell = groupsSheet.getRange(
          targetRow,
          thumbnailIndex + 1
        );
        const thumbnailUrl = String(thumbnailCell.getValue() || "").trim();
        if (thumbnailUrl) {
          const fileId = getThumbnailFileId(thumbnailUrl);
          const folderId = PropertiesService
            .getScriptProperties()
            .getProperty("THUMBNAIL_FOLDER_ID");
          if (!folderId) {
            throw new Error("THUMBNAIL_FOLDER_ID is missing from Script Properties.");
          }

          const file = DriveApp.getFileById(fileId);
          if (!thumbnailFileBelongsToFolder(file, folderId)) {
            throw new Error("The saved thumbnail is not in the configured thumbnail folder.");
          }

          file.setTrashed(true);
          thumbnailCell.clearContent();
        }

        return responseJSON({
          success: true,
          message: "Project thumbnail deleted successfully.",
          thumbnail: null
        });
      } finally {
        lock.releaseLock();
      }
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
  "ResearchPaperRating",
  "PitchVideoRating",
  "PosterRating",
  "LogoRating",
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

function createFacultySession(facultyId, role) {
  const normalizedFacultyId = String(facultyId || "").trim();
  if (!normalizedFacultyId) {
    throw new Error("The authenticated faculty does not have a FacultyID.");
  }
  const sessionToken = Utilities.getUuid();
  CacheService.getScriptCache().put(
    "faculty-session:" + sessionToken,
    JSON.stringify({ facultyId: normalizedFacultyId, role: role }),
    21600
  );
  return sessionToken;
}

function createGuestSession(guestId) {
  const sessionToken = Utilities.getUuid();
  CacheService.getScriptCache().put(
    "guest-session:" + sessionToken,
    JSON.stringify({ guestId: guestId || "GUEST-001" }),
    21600
  );
  return sessionToken;
}

function getAuthenticatedAdmin(sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) {
    throw new Error("A valid session is required. Please sign in again.");
  }

  const sessionData = CacheService.getScriptCache().get(
    "faculty-session:" + token
  );
  if (!sessionData) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  let session;
  try {
    session = JSON.parse(sessionData);
  } catch (error) {
    throw new Error("Your faculty session is invalid. Please sign in again.");
  }

  if (
    !String(session.facultyId || "").trim() ||
    normalizeFacultyRole(session.role) !== "admin"
  ) {
    throw new Error("Only faculty administrators can view rating analytics.");
  }
  return {
    type: "faculty",
    facultyId: String(session.facultyId).trim(),
    role: "admin"
  };
}

function getAuthenticatedFacultyForEvaluationHistory(spreadsheet, sessionToken) {
  const token = String(sessionToken || "").trim();
  const sessionData = token
    ? CacheService.getScriptCache().get("faculty-session:" + token)
    : null;
  if (!sessionData) {
    throw new Error("A valid faculty session is required. Please sign in again.");
  }

  let session;
  try {
    session = JSON.parse(sessionData);
  } catch (error) {
    throw new Error("Your faculty session is invalid. Please sign in again.");
  }
  if (normalizeFacultyRole(session.role) === "admin") {
    return getAuthenticatedAdmin(token);
  }

  const evaluator = getAuthenticatedEvaluator(spreadsheet, token);
  if (evaluator.type !== "faculty") {
    throw new Error("Only signed-in faculty can view their evaluations.");
  }
  return evaluator;
}

function getAuthenticatedEvaluator(spreadsheet, sessionToken) {
  const token = String(sessionToken || "").trim();
  if (!token) {
    throw new Error("A valid session is required. Please sign in again.");
  }

  // Check guest cache
  const guestData = CacheService.getScriptCache().get("guest-session:" + token);
  if (guestData) {
    return { type: "guest", guestId: "GUEST-001" };
  }

  // Check faculty cache
  const facultyData = CacheService.getScriptCache().get("faculty-session:" + token);
  if (facultyData) {
    let parsed;
    try {
      parsed = JSON.parse(facultyData);
    } catch (e) {
      throw new Error("Your faculty session is invalid. Please sign in again.");
    }
    const facultySheet = getRequiredSheet(spreadsheet, "Faculty");
    const facultyMembers = getSheetData(facultySheet);
    const sessionFacultyId = String(parsed.facultyId || "").trim();
    if (!sessionFacultyId) {
      throw new Error("Your faculty session is invalid. Please sign in again.");
    }
    const member = facultyMembers.find(function(f) {
      return String(f.FacultyID || "").trim() === sessionFacultyId;
    });
    if (!member) {
      throw new Error("The faculty account for this session could not be found.");
    }
    return {
      type: "faculty",
      facultyId: String(member.FacultyID || "").trim(),
      fullName: String(member.FullName || "").trim(),
      role: normalizeFacultyRole(member.Role)
    };
  }

  // Check student cache
  const student = getAuthenticatedStudent(spreadsheet, token);
  return {
    type: "student",
    studentId: student.studentId,
    groupCode: student.groupCode
  };
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

function getEvaluationHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  const headers = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(function(header) {
      return String(header).trim();
    })
    : [];
  if (
    headers.length !== EVALUATION_HEADERS.length ||
    !EVALUATION_HEADERS.every(function(header) {
      return headers.indexOf(header) !== -1;
    })
  ) {
    throw new Error(
      "The Evaluations sheet must include these columns: " +
      EVALUATION_HEADERS.join(", ")
    );
  }
  return headers;
}

function getEvaluationRows(sheet) {
  getEvaluationHeaders(sheet);
  return getSheetData(sheet);
}

function getRatingAnalyticsRows(spreadsheet, evaluations) {
  const students = getSheetData(getRequiredSheet(spreadsheet, "Students"));
  const faculty = getSheetData(getRequiredSheet(spreadsheet, "Faculty"));
  const studentIds = new Set(students.map(function(student) {
    return String(getStudentField(student, [
      "student no.",
      "student number",
      "student id",
      "member #",
      "member number"
    ]) || "").trim();
  }).filter(Boolean));
  const facultyIds = new Set(faculty.map(function(member) {
    return String(getStudentField(member, ["faculty id", "facultyid"]) || "").trim();
  }).filter(Boolean));

  return evaluations.map(function(evaluation) {
    const evaluatorId = String(evaluation.StudentID || "").trim();
    const evaluatorType = studentIds.has(evaluatorId)
      ? "student"
      : facultyIds.has(evaluatorId) ? "faculty" : "unknown";
    return {
      EvaluationID: evaluation.EvaluationID,
      StudentID: evaluatorId,
      GroupCode: evaluation.GroupCode,
      ResearchPaperRating: evaluation.ResearchPaperRating,
      PitchVideoRating: evaluation.PitchVideoRating,
      PosterRating: evaluation.PosterRating,
      LogoRating: evaluation.LogoRating,
      SubmittedAt: evaluation.SubmittedAt,
      EvaluatorType: evaluatorType
    };
  });
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

function getEvaluationEligibility(evaluator, groupCode, evaluations, groups, spreadsheet) {
  if (evaluator.type === "guest") {
    return {
      canEvaluate: false,
      code: "guest",
      reason: "Guests cannot evaluate projects.",
      submitted: 0
    };
  }

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
  } else if (evaluator.type === "student" && normalizeGroupCode(evaluator.groupCode) === requestedGroupCode) {
    code = "own-group";
    reason = "You cannot evaluate your own group.";
  } else if (evaluator.type === "faculty" && spreadsheet) {
    const groupsSheet = getRequiredSheet(spreadsheet, "Groups");
    const groupsData = getSheetData(groupsSheet);
    const targetGroup = groupsData.find(function(g) {
      return normalizeGroupCode(g.GroupCode) === requestedGroupCode;
    });
    if (targetGroup) {
      const adviser = String(targetGroup.Adviser || "").trim().toLowerCase();
      const facultyId = String(evaluator.facultyId || "").trim().toLowerCase();
      const facultyName = String(evaluator.fullName || "").trim().toLowerCase();
      if (adviser && (adviser === facultyId || adviser === facultyName)) {
        code = "assigned-team";
        reason = "Faculty advisers cannot evaluate groups assigned to them.";
      }
    }
  }

  if (code === "ok" && existing) {
    code = "duplicate";
    reason = "You have already evaluated this group.";
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
    submitted: submitted
  };
}

function replaceGroupThumbnailFile(
  folder,
  folderId,
  groupCode,
  existingThumbnailUrl,
  blob,
  fileName
) {
  const existingFiles = findGroupThumbnailFiles(folder, groupCode);
  const referencedFile = findReferencedThumbnailFile(
    existingThumbnailUrl,
    folderId
  );
  if (referencedFile && !existingFiles.some(function(candidate) {
    return candidate.getId() === referencedFile.getId();
  })) {
    existingFiles.push(referencedFile);
  }

  // A new Drive file ID prevents Drive and browsers from serving the old
  // thumbnail after its contents are replaced.
  const file = folder.createFile(blob);
  file.setName(fileName);

  existingFiles.forEach(function(candidate) {
    if (candidate.getId() !== file.getId() && !candidate.isTrashed()) {
      candidate.setTrashed(true);
    }
  });

  return file;
}

function findReferencedThumbnailFile(thumbnailUrl, folderId) {
  if (!thumbnailUrl) return null;

  let fileId;
  try {
    fileId = getThumbnailFileId(thumbnailUrl);
  } catch (error) {
    return null;
  }

  let file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (error) {
    return null;
  }

  if (file.isTrashed()) return null;

  if (!thumbnailFileBelongsToFolder(file, folderId)) {
    throw new Error("The saved thumbnail is not in the configured thumbnail folder.");
  }

  return file;
}

function findGroupThumbnailFiles(folder, groupCode) {
  const matches = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (!file.isTrashed() && isGroupThumbnailFileName(file.getName(), groupCode)) {
      matches.push(file);
    }
  }

  return matches;
}

function isGroupThumbnailFileName(name, groupCode) {
  const upperName = String(name || "").toUpperCase();
  const prefix = "THUMBNAIL_" + String(groupCode || "").toUpperCase();
  if (upperName.indexOf(prefix) !== 0) return false;

  const nextCharacter = upperName.charAt(prefix.length);
  return nextCharacter === "." || nextCharacter === "_";
}

function thumbnailFileBelongsToFolder(file, folderId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

function getThumbnailFileId(thumbnailUrl) {
  if (!/^https:\/\/drive\.google\.com\/(?:thumbnail|uc|file\/d\/)/.test(thumbnailUrl)) {
    throw new Error("The saved thumbnail URL is invalid.");
  }

  const match = thumbnailUrl.match(
    /(?:[?&]id=|\/file\/d\/)([A-Za-z0-9_-]+)/
  );
  if (!match) {
    throw new Error("The saved thumbnail URL does not contain a valid file ID.");
  }
  return match[1];
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
// evaluation id generation
function generateEvaluationId(sheet) {
  const lastRow = sheet.getLastRow();
  const idColumn = getEvaluationHeaders(sheet).indexOf("EvaluationID") + 1;

  // First evaluation
  if (lastRow <= 1) {
    return "EV-0001";
  }

  const existingIds = sheet
    .getRange(2, idColumn, lastRow - 1, 1)
    .getDisplayValues()
    .flat();

  let highestNumber = 0;

  existingIds.forEach(function(id) {
    const match = String(id).trim().match(/^EV-(\d+)$/);

    if (match) {
      const number = Number(match[1]);

      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  });

  const nextNumber = highestNumber + 1;

  return "EV-" + String(nextNumber).padStart(4, "0");
}

function authorizeDriveAccess() {
  const folder = DriveApp.getFolderById(
    "1R2tRr5_00JfIg3aukcdK0GcPBw8x-RFv"
  );

  Logger.log(folder.getName());
}
function authorizeDriveWriteAccess() {
  const folderId = "1R2tRr5_00JfIg3aukcdK0GcPBw8x-RFv";

  const folder = DriveApp.getFolderById(folderId);

  // Create a temporary file to trigger Drive write authorization.
  const testFile = folder.createFile(
    "drive-authorization-test.txt",
    "Temporary authorization test."
  );

  Logger.log("File created: " + testFile.getName());

  // Move the temporary file to Trash.
  testFile.setTrashed(true);

  Logger.log("Drive write authorization successful.");
}
function testEditorExecution() {
  Logger.log("Apps Script editor is working.");
  return "SUCCESS";
}

function testDriveRootWrite() {
  const file = DriveApp.createFile(
    "drive-test.txt",
    "Testing Drive write access."
  );

  Logger.log("Created file: " + file.getName());

  file.setTrashed(true);

  Logger.log("Test successful. File moved to trash.");
}

function authorizeExternalRequest() {
  const response = UrlFetchApp.fetch("https://www.google.com", {
    muteHttpExceptions: true
  });

  Logger.log("External request authorization successful.");
  Logger.log("Response code: " + response.getResponseCode());
}