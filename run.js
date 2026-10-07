const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const args = process.argv.slice(2);
const valueAfter = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const project = path.resolve(valueAfter("--project") || process.cwd());
const command = valueAfter("--command");
const port = valueAfter("--port") || "4173";
const entry = valueAfter("--entry") || "index.html";
const backendUrl = valueAfter("--backend-url") || "http://127.0.0.1:3000";
const tracker = path.join(__dirname, "tracker.js");

if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) {
  console.error(`Pasta do projeto não encontrada: ${project}`);
  process.exit(1);
}

const trackerArgs = [tracker, "--project", project, "--port", port, "--entry", entry];
const trackerProcess = spawn(process.execPath, backendUrl ? [...trackerArgs, "--backend-url", backendUrl] : trackerArgs, {
  stdio: "inherit",
  windowsHide: false,
});

let projectProcess;
let projectCwd = project;
if (command) {
  projectProcess = spawn(command, {
    cwd: projectCwd,
    shell: true,
    stdio: "inherit",
  });
} else {
  const backendDirectory = path.join(project, "backend");
  const backendPackageFile = path.join(backendDirectory, "package.json");
  const projectPackageFile = path.join(project, "package.json");
  const packageFile = fs.existsSync(backendPackageFile) ? backendPackageFile : projectPackageFile;
  if (fs.existsSync(backendPackageFile)) projectCwd = backendDirectory;
  if (fs.existsSync(packageFile)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
      if (packageJson.scripts && packageJson.scripts.start) {
        projectProcess = spawn("npm", ["run", "start"], {
          cwd: projectCwd,
          shell: true,
          stdio: "inherit",
        });
      }
    } catch (error) {
      console.error(`Não foi possível ler ${packageFile}: ${error.message}`);
    }
  }
}

console.log("");
console.log("Tracking Observer iniciado.");
console.log(`Projeto monitorado: ${project}`);
console.log(`Abra o projeto: http://127.0.0.1:${port}/`);
console.log(`Abra o rastreamento: http://127.0.0.1:${port}/__tracker/`);
if (!projectProcess) {
  console.log("Nenhum servidor do projeto foi iniciado; o rastreador está servindo os arquivos estáticos.");
}

function stop() {
  if (projectProcess && !projectProcess.killed) projectProcess.kill();
  if (!trackerProcess.killed) trackerProcess.kill();
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
trackerProcess.on("exit", (code) => {
  if (code && code !== 0) {
    console.error(`O Tracking Observer encerrou com código ${code}.`);
    if (projectProcess && !projectProcess.killed) projectProcess.kill();
    process.exit(code);
  }
});
