import { Result, ResultErr, ResultOk } from "@polywrap/result";
import {
  FUNCTION_NOT_FOUND,
  UNDEFINED_FUNCTION_ARGS,
  UNDEFINED_FUNCTION_NAME,
  UNPARSABLE_FUNCTION_ARGS,
  FUNCTION_CALL_FAILED,
  EXECUTE_SCRIPT_OUTPUT,
  OTHER_EXECUTE_FUNCTION_OUTPUT,
  READ_GLOBAL_VAR_OUTPUT
} from "./prompts";
import { Workspace, } from "../sys";
import { Scripts } from "../Scripts";
import { WrapClient } from "../wrap";
import { LlmApi, Chat } from "../llm";
import { trimText } from "./utils";

export interface AgentContext {
  globals: Record<string, string>;
  client: WrapClient;
  workspace: Workspace;
  scripts: Scripts;
  llm: LlmApi;
  chat: Chat;
}

export interface AgentFunction {
  definition: any;
  buildExecutor: (
    context: AgentContext
  ) => (options: any) => Promise<any>;
}

export type ExecuteAgentFunction = (
  name: string | undefined,
  args: string | undefined,
  context: AgentContext,
  agentFunctions: AgentFunction[],
) => Promise<Result<string, string>>;

export const executeAgentFunction: ExecuteAgentFunction = async (
  name: string | undefined,
  args: string | undefined,
  context: AgentContext,
  agentFunctions: AgentFunction[],
): Promise<Result<string, string>> => {
  const result = processFunctionAndArgs(name, args, agentFunctions);

  if (!result.ok) {
    return ResultErr(result.error);
  }

  const [fnArgs, func] = result.value;
  const fnName = name as string;

  const argsStr = JSON.stringify(fnArgs, null, 2);
  let functionCallSummary = `Function call: \`${fnName}(${argsStr})\`\n`;

  const executor = func.buildExecutor(context);

  const response = await executor(fnArgs);

  if (!response.ok) {
    return ResultErr(FUNCTION_CALL_FAILED(fnName, response.error, args));
  }

  if (fnName === "executeScript") {
    functionCallSummary += `Result stored into global var: \`{{${fnArgs.result}}}\`. Preview: \`${trimText(response.result, 200)}\`\n`;
    functionCallSummary +=  EXECUTE_SCRIPT_OUTPUT(fnArgs.result, response.result);
  } else if (fnName === "readVar") {
    functionCallSummary += READ_GLOBAL_VAR_OUTPUT(fnArgs.name, response.result);
  } else {
    functionCallSummary += OTHER_EXECUTE_FUNCTION_OUTPUT(response.result);
  }

  return ResultOk(functionCallSummary);
}

function processFunctionAndArgs(
  name: string | undefined,
  args: string | undefined,
  agentFunctions: AgentFunction[],
): Result<[any, AgentFunction], string> {
  if (!name) {
    return ResultErr(UNDEFINED_FUNCTION_NAME);
  }

  const func = agentFunctions.find((f) => f.definition.name === name);
  if (!func) {
    return ResultErr(FUNCTION_NOT_FOUND(name));
  }

  if (!args) {
    return ResultErr(UNDEFINED_FUNCTION_ARGS(name));
  }

  let fnArgs;
  try {
    fnArgs = args
      ? JSON.parse(args)
      : undefined;
  } catch(err: any) {
    return ResultErr(UNPARSABLE_FUNCTION_ARGS(name, args, err));
  }

  return ResultOk([fnArgs, func]);
}