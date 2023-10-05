import { Agent, AgentFunctionResult, AgentOutputType, ChatMessageBuilder, JsEngine, JsEngine_GlobalVar, shimCode, trimText } from "@evo-ninja/agent-utils";
import { Result, ResultErr, ResultOk } from "@polywrap/result";
import JSON5 from "json5";
import { AgentFunctionBase, HandlerResult } from "../../../AgentFunctionBase";
import { EvoContext } from "../config";
import { FUNCTION_CALL_FAILED, FUNCTION_CALL_SUCCESS_CONTENT } from "../utils";
;

interface ExecuteScriptFuncParameters { 
  namespace: string, 
  description: string, 
  arguments: string,
  variable?: string
};

export class ExecuteScriptFunction extends AgentFunctionBase<EvoContext, ExecuteScriptFuncParameters> {
  get name(): string {
    return "executeScript";
  }
  get description(): string {
    return `Execute an script.`;
  }
  get parameters() {
    return {
      type: "object",
      properties: {
        namespace: {
          type: "string",
          description: "Namespace of the script to execute"
        },
        arguments: {
          type: "string",
          description: "JSON-formatted arguments to pass into the script being executed. You can replace a value with a global variable by using {{varName}} syntax.",
        },
        variable: {
          type: "string",
          description: "The name of a variable to store the script's result in"
        }
      },
      required: ["namespace", "arguments", "result"],
      additionalProperties: false
    }
  }

  buildExecutor(agent: Agent<unknown>, context: EvoContext): (params: ExecuteScriptFuncParameters) => Promise<Result<AgentFunctionResult, string>> {
    return async (params: ExecuteScriptFuncParameters): Promise<Result<AgentFunctionResult, string>> => {
      try {
        const script = context.scripts.getScriptByName(params.namespace);

        if (!script) {
          return ResultOk(this.onError(params.namespace, this.scriptNotFound(params), params));
        }

        let args: any = undefined;
        args = params.arguments ? params.arguments.replace(/\{\{/g, "\\{\\{").replace(/\}\}/g, "\\}\\}") : "{}";
        try {

          args = JSON5.parse(params.arguments);

          if (args) {
            const replaceVars = (str: string, vars: any) => {
              return str.replace(/{{(.*?)}}/g, (match, key) => {
                return vars[key.trim()] || match;  // if the key doesn't exist in vars, keep the original match
              });
            }
            for (const key of Object.keys(args)) {
              if (typeof args[key] === "string") {
                args[key] = replaceVars(
                  args[key],
                  Object.keys(context.globals).reduce(
                    (a, b) => ({ [b]: JSON.parse(context.globals[b]), ...a}), {}
                  )
                );
              }
            }
          }
        } catch {
          return ResultOk(this.onError(params.namespace, this.invalidExecuteScriptArgs(params), params));
        }

        const globals: JsEngine_GlobalVar[] =
          Object.entries(args).map((entry) => ({
              name: entry[0],
              value: JSON.stringify(entry[1]),
            })
          );

        const jsEngine = new JsEngine(context.client);

        const result = await jsEngine.evalWithGlobals({
          src: shimCode(script.code),
          globals
        });

        if (params.variable && result.ok && context.client.jsPromiseOutput.ok) {
          context.globals[params.variable] =
            JSON.stringify(context.client.jsPromiseOutput.value);
        }

        return result.ok
          ? result.value.error == null
            ? context.client.jsPromiseOutput.ok
              ? ResultOk(this.onSuccess(params.namespace, context.client.jsPromiseOutput.value, params))
              : ResultOk(this.onError(params.namespace, JSON.stringify(context.client.jsPromiseOutput.error), params))
            : ResultOk(this.onError(params.namespace, result.value.error, params))
          : ResultOk(this.onError(params.namespace, result.error?.toString(), params));
      
      } catch (e: any) {
        return ResultErr(e);
      }
    };
  }

  private onSuccess(scriptName: string, result: any, params: ExecuteScriptFuncParameters): HandlerResult {
    return {
      outputs: [
        {
          type: AgentOutputType.Success,
          title: `Executed '${scriptName}' script.`,
          content: FUNCTION_CALL_SUCCESS_CONTENT(
            this.name,
            params,
            this.executeScriptOutput(params.variable, result),
          )
        }
      ],
      messages: [
        ChatMessageBuilder.functionCall(this.name, params),
        ChatMessageBuilder.functionCallResult(
          this.name,
          this.executeScriptOutput(params.variable, result)
        ),
      ]
    }
  }

  private onError(scriptName: string, error: string | undefined, params: ExecuteScriptFuncParameters) {
    return {
      outputs: [
        {
          type: AgentOutputType.Error,
          title: `'${scriptName}' script failed to execute!`,
          content: FUNCTION_CALL_FAILED(params, this.name, error ?? "Unknown error"),
        }
      ],
      messages: [
        ChatMessageBuilder.functionCall(this.name, params),
        ChatMessageBuilder.functionCallResult(
          this.name,
          `Error executing script '${scriptName}'\n` + 
          `\`\`\`\n` +
          `${
            error && typeof error === "string"
              ? trimText(error, 300)
              : error 
                ? trimText(JSON.stringify(error, null, 2), 300)
                : "Unknown error"
            }\n` +
          `\`\`\``
        ),
      ]
    }
  }

  private invalidExecuteScriptArgs(params: ExecuteScriptFuncParameters) {
    return `Invalid arguments provided for script ${params.namespace}: '${params.arguments ?? ""}' is not valid JSON!`;
  }

  private scriptNotFound(params: ExecuteScriptFuncParameters) {
    return `Script '${params.namespace}' not found!`;
  }

  private executeScriptOutput(varName: string | undefined, result: string | undefined) {
    if (!result || result === "undefined" || result === "\"undefined\"") {
      return `No result returned.`;
    } else if (result.length > 3000) {
      return `Preview of JSON result:\n` + 
            `\`\`\`\n` + 
            `${trimText(result, 3000)}\n` + 
            `\`\`\`\n` + 
            `${this.storedResultInVar(varName)}`;
    } else {
      return `JSON result: \n\`\`\`\n${result}\n\`\`\`\n${this.storedResultInVar(varName)}`;
    }
  }

  private storedResultInVar(varName: string | undefined) {
    if (varName && varName.length > 0) {
      return `Result stored in variable: {{${varName}}}`;
    } else {
      return "";
    }
  }
}