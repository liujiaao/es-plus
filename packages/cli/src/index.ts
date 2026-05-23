#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { program } from "commander";
import { createCommand } from "./commands/create.js";
import { validateCommand } from "./commands/validate.js";
import { scaffoldCommand } from "./commands/scaffold.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

program
  .name("es-plus")
  .description("es-plus-ui CLI — generate CRUD pages & validate configs")
  .version(pkg.version);

program.addCommand(createCommand);
program.addCommand(validateCommand);
program.addCommand(scaffoldCommand);

program.parse();
