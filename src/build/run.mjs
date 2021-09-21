#!/usr/bin/env node
import nodePath from "path";
import process from "process";
import childProcess from "child_process";
import { fileURLToPath } from "url";
import which from "which";
import { repr, PathInfo } from "../utils.js";

const SCRIPT_DIR = nodePath.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = nodePath.dirname(nodePath.dirname(SCRIPT_DIR));
const PREPROCESSOR_PATH = nodePath.join(SCRIPT_DIR, "preprocess.mjs");
const PREPROCESSOR_RELPATH = nodePath.relative(process.cwd(), PREPROCESSOR_PATH);

let command = process.argv[2];

if (command !== "develop" && command !== "build") {
    console.error(repr`Invalid command ${command}. Must give 'develop' or 'build'.`);
    process.exit(1);
}

// Preprocess content.
let argv = process.argv.slice();
argv[2] = "preprocess";
let cmd1 = [PREPROCESSOR_RELPATH, ...argv.slice(2)].join(" ");
console.log(`$ ${cmd1}`);
let { status: code, signal} = childProcess.spawnSync(PREPROCESSOR_RELPATH, argv.slice(2), { stdio: "inherit" });
if (code) {
    console.error(`${cmd1} exited with code ${code}`);
}
if (signal) {
    console.error(`${cmd1} exited due to signal ${signal}`);
}
if (code !== 0) {
    process.exit(code);
}

// Start hot reloader, if running developer server.
if (command === "develop") {
    let args = ["watch", ...process.argv.slice(3)];
    let cmd2 = [PREPROCESSOR_RELPATH, ...args].join(" ");
    console.log(`$ ${cmd2} &`);
    let watcher = childProcess.spawn(PREPROCESSOR_PATH, args, { stdio: "inherit" });
    watcher.on('exit', (code, signal) => {
        if (code) {
            console.error(`${cmd2} exited with code ${code}`);
        }
        if (signal) {
            console.error(`${cmd2} exited due to signal ${signal}`);
        }
        process.exit(code);
    });
}

// Start Gridsome.
let gridsomeExe = findGridsome();
let cmd3 = `${gridsomeExe} ${command}`;
console.log(`$ ${cmd3}`);
let gridsome = childProcess.spawn(gridsomeExe, [command], { stdio: "inherit" });
gridsome.on('exit', (code, signal) => {
    if (signal) {
        console.error(`${cmd3} exited due to signal ${signal}`);
    }
    if (code !== null) {
        process.exitCode = code;
    }
});
//TODO: Get Gridsome's colors working in stdout again.

/** Find the correct command to execute Gridsome. */
function findGridsome() {
    if (which.sync("gridsome", { nothrow: true })) {
        return "gridsome";
    }
    let modulesDir = nodePath.join(PROJECT_ROOT, "node_modules");
    if (new PathInfo(modulesDir).type() === "dir") {
        for (let moduleName of ["gridsome", "@gridsome"]) {
            for (let relScriptPath of ["bin/gridsome.js", "cli/bin/gridsome.js"]) {
                let scriptPath = nodePath.join(modulesDir, moduleName, relScriptPath);
                if (new PathInfo(scriptPath).type() === "file") {
                    return scriptPath;
                }
            }
        }
    }
}
