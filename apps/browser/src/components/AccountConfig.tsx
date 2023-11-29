import { useSession, signOut, signIn } from "next-auth/react";
import React, { useState } from "react";

interface AccountConfigProps {
  apiKey: string | null;
  onConfigSaved: (apiKey: string) => void;
  capReached: boolean;
  onClose: () => void;
}

function AccountConfig(props: AccountConfigProps) {
  const [apiKey, setApiKey] = useState<string>(props.apiKey || "");
  const { onConfigSaved, capReached } = props;
  const { data: session } = useSession();

  return (
    <div
      className="absolute inset-0 z-50 bg-neutral-900/80"
      onClick={props.onClose}
    >
      <div
        className="fixed left-1/2 top-1/2 flex w-96 -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg bg-neutral-900 p-12 text-neutral-50"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {!capReached && <h2 className="text-lg font-semibold">Account</h2>}
        {!session && (
          <>
            <button
              className="cursor-pointer rounded-xl border-none bg-orange-600 p-2.5 text-white transition-all hover:bg-orange-500"
              onClick={() => signIn()}
            >
              Sign in
            </button>
            <h3 className="flex items-center justify-center text-lg font-semibold">
              - or -
            </h3>
          </>
        )}
        {!!session && !capReached && (
          <button
            className="cursor-pointer rounded-xl border-none bg-orange-600 p-2.5 text-white transition-all hover:bg-orange-500"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        )}
        <h4 className="font-semibold">Provide your own OpenAI API key</h4>
        {capReached && (
          <h4 className="text-md">
            You have used all of your free daily prompts. Please enter your
            OpenAI API key or try again tomorrow.
          </h4>
        )}
        <input
          className="rounded border border-neutral-600 bg-neutral-950 p-2.5 text-neutral-50 outline-none transition-all"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button
          className="cursor-pointer rounded-xl border-none bg-orange-600 p-2.5 text-white transition-all hover:bg-orange-500"
          onClick={() => onConfigSaved(apiKey)}
        >
          Save
        </button>

        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" value="" className="peer sr-only" />
          <div className="peer h-6 w-11 rounded-full bg-orange-500 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-orange-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rtl:peer-checked:after:-translate-x-full dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:orange-500"></div>
          <span className="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">
            Share prompts with Evo team
          </span>
        </label>
      </div>
    </div>
  );
}

export default AccountConfig;