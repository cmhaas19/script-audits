const fs = require("fs-extra");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");
const { calculateLicenses } = require("./calculate-licenses.js");
const cliProgress = require("cli-progress");

if (typeof String.prototype.replaceAll === "undefined") {
  console.error(
    "You are using a version of Node that does not support String.prototype.replaceAll. Please use Node 15.0.0 or higher."
  );
  process.exit(1);
}

const LICENSE_SOURCE_CODES = {
  1: "subscription",
  2: "extension",
  3: "referring field",
  4: "reference field",
  5: "relationship to",
  6: "relationship from",
  7: "flow action",
  8: "flow trigger"
};
const PROCESSED_OUT_DIR = "output";
const CALCULATED_OUT_DIR = "output";
const OUT_FILE_NAME = "instance_data";
const INSTANCE_LIST = "instance_list.csv";

// Grep for errors -> cat data/readaudit_v0_1.csv | grep Script | grep "\.\.\." | wc -l

function invertLicenseMap(l) {
  const licenses = {};
  for (const [license, code] of Object.entries(l)) {
    licenses[code] = license;
  }
  return licenses;
}

function setupDir() {
  // Clear out old processed data
  console.log("Clearing out old processed data...");
  fs.rmSync(path.join("farm_scans", PROCESSED_OUT_DIR), {
    recursive: true,
    force: true
  });
  fs.rmSync(path.join("farm_scans", CALCULATED_OUT_DIR), {
    recursive: true,
    force: true
  });
  fs.rmSync(path.join("farm_scans", INSTANCE_LIST), {
    force: true
  });

  // Recreate the OUT_DIR for new processed data
  console.log("Creating new directories for output data...");
  fs.mkdirSync(path.join("farm_scans", PROCESSED_OUT_DIR));

  if (PROCESSED_OUT_DIR !== CALCULATED_OUT_DIR) {
    fs.mkdirSync(path.join("farm_scans", CALCULATED_OUT_DIR));
  }
}

function writeFile(processedData, dir, fileName) {
  fs.writeFileSync(
    path.join(path.join("farm_scans", dir), fileName),
    JSON.stringify(processedData, null, 4)
  );
}

function writeLine(line, dir, fileName) {
  fs.appendFileSync(
    path.join(path.join("farm_scans", dir), fileName),
    `\n${line}`
  );
}

function isGrandFatheredLicense(license) {
  const grandFatheredLicenses = [
    "($0 ACV) Grandfathered Custom Tables - Custom Tables",
    "(WITH ACV) Grandfathered Custom Tables - Custom Tables",
    "Grandfathered Custom Tables - Custom Tables"
  ];

  return grandFatheredLicenses.includes(license);
}

function processData(data) {
  const { l, t } = data;
  const licensesMap = invertLicenseMap(l);
  const result = {};
  for (const [table, d] of Object.entries(t)) {
    let relatedLicensesAndTables = d.r.map(({ t, s, l }) => {
      const source = {
        code: s,
        label: LICENSE_SOURCE_CODES[s]
      };
      if (t) {
        return { table: t, source };
      }
      const license = licensesMap[l];
      return { license, source };
    });

    relatedLicensesAndTables.filter(
      (entry) => !isGrandFatheredLicense(entry.license)
    );

    const license = licensesMap[d.l];
    const assignedLicense = isGrandFatheredLicense(license) ? null : license;
    const hasAssignedLicense = !!license;
    result[table] = {
      hasAssignedLicense,
      assignedLicense: assignedLicense,
      relatedLicensesAndTables
    };
  }

  return result;
}

function processLine(line) {
  const matchString = "*** Script: ";
  const splitIdx = line.indexOf(matchString);
  let left = null;
  let fileName = OUT_FILE_NAME;
  let right = null;

  let result;

  if (splitIdx > 0) {
    try {
      // The left side contains the instance details
      left = line.substring(0, splitIdx - 2);
      fileName = left.split(",")[0];
      fileName = fileName.replaceAll('"', "");

      // The right side contains the instance result
      right = line.substring(splitIdx + matchString.length);

      // Remove the double quotes around keys and vals
      right = right.replaceAll('""', '"');

      // Remove trailing quote if present
      right =
        right[right.length - 1] === '"'
          ? right.substring(0, right.length - 1)
          : right;

      result = {
        fileName,
        isValid: true,
        data: JSON.parse(right),
        hasError: false
      };

      return result;
    } catch (e) {
      result = {
        fileName,
        isValid: true,
        data: null,
        hasError: true
      };
      return result;
    }
  } else {
    result = {
      fileName,
      isValid: false,
      data: null,
      hasError: false
    };
  }

  return result;
}

function fastCountLines(filePath) {
  const output = execSync(`wc -l ${filePath} | awk '{print $1}'`, {
    cwd: __dirname,
    encoding: "utf-8"
  });
  return parseInt(output.trim());
}

async function main() {
  setupDir();

  const inputFilePath = "./results.json";
  const fileStream = fs.createReadStream(inputFilePath);

  let invalidCount = 0;
  let processErrorCount = 0;
  let totalCount = 0;
  let timeoutCount = 0;

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let processedData = null;
  let calculatedData = null;

  const totalLines = fastCountLines(inputFilePath);
  console.log(
    `Processing ${totalLines} lines of data from ${inputFilePath}...`
  );

  const progressBar = new cliProgress.SingleBar(
    { format: "[{bar}] {percentage}% | {value}/{total}" },
    cliProgress.Presets.shades_classic
  );
  progressBar.start(totalLines, 0);

  for await (const line of rl) {
    progressBar.increment(1);
    totalCount++;

    const processedLine = processLine(line);

    if (processedLine.hasError === true) {
      processErrorCount++;
      continue;
    }

    if (processedLine.isValid === false) {
      invalidCount++;
      continue;
    }

    const processedFileName = `${processedLine.fileName}_processed.json`;
    const calculatedFileName = `${processedLine.fileName}_calculated.json`;
    const calculatedStatsFileName = `${processedLine.fileName}_stats.json`;
    const calculatedPathsFileName = `${processedLine.fileName}_paths.json`;

    try {
      writeLine(processedLine.fileName, "", INSTANCE_LIST);
    } catch (e) {
      console.log(`ERROR while writing to ${INSTANCE_LIST}`, e);
    }

    try {
      processedData = processData(processedLine.data);
      writeFile(processedData, PROCESSED_OUT_DIR, processedFileName);
    } catch (e) {
      console.log(`ERROR while processing ${processedFileName}`, e);
    }

    try {
      calculatedData = calculateLicenses(processedData, calculatedFileName);
      writeFile(
        calculatedData.CALCULATED_DATA,
        CALCULATED_OUT_DIR,
        calculatedFileName
      );
      writeFile(
        calculatedData.STATS,
        CALCULATED_OUT_DIR,
        calculatedStatsFileName
      );
    } catch (e) {
      console.log(`ERROR while calculating ${calculatedFileName}`, e);
    }
  }

  progressBar.stop();

  for (let i = 0; i < calculatedData.NUM_RECOMMENDATIONS; i++) {
    const appEngine = calculatedData.ALL_STATS.recommendations[i].appEngine;
    const OOTBLicense = calculatedData.ALL_STATS.recommendations[i].OOTBLicense;
    const total = appEngine + OOTBLicense;

    calculatedData.ALL_STATS.recommendations[i].same = (
      (appEngine / total) *
      100
    ).toFixed(2);
    calculatedData.ALL_STATS.recommendations[i].different = (
      (OOTBLicense / total) *
      100
    ).toFixed(2);
  }

  writeFile(calculatedData.ALL_STATS, CALCULATED_OUT_DIR, "zz__all_stats.json");

  console.log(`invalidCount : ${invalidCount}`);
  console.log(`processErrorCount : ${processErrorCount}`);
  console.log(`timeoutCount : ${timeoutCount}`);
  console.log(`totalCount : ${totalCount}`);
}

function calculateSingleFile(fileName) {
  const data = require("./farm_scans/" + fileName);

  const processedFileName = `${fileName}_processed.json`;
  const calculatedFileName = `${fileName}_calculated.json`;

  let processedData;
  let calculatedData;

  try {
    processedData = processData(data);
    writeFile(processedData, PROCESSED_OUT_DIR, processedFileName);
  } catch (e) {
    console.log(`ERROR while processing ${processedFileName}`, e);
  }

  try {
    calculatedData = calculateLicenses(processedData, calculatedFileName);
    writeFile(
      calculatedData.CALCULATED_DATA,
      CALCULATED_OUT_DIR,
      calculatedFileName
    );
  } catch (e) {
    console.log(`ERROR while calculating ${calculatedFileName}`, e);
  }
}

main();
// calculateSingleFile("yum");
// calculateSingleFile("bestseller");
// calculateSingleFile("coxprod");
// calculateSingleFile("worleyparsons");