import axios from "axios";
import { ETHERSCAN_API_KEY, execute } from ".";
import { type SubmissionConfig } from "../types";
import fs from "fs";

/**
 * 1. Fetch the contract source code from Etherscan
 * 2. Save the contract source code into the appropriate challenge directory
 */
export const downloadContract = async (
  config: SubmissionConfig
): Promise<void> => {
  const { challenge, network, contractAddress } = config;
  console.log(`📡 Downloading ${contractAddress} from ${network}...`);
  const API_URL = `https://api-${network}.etherscan.io/api`;
  const paramString = `?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`;

  let sourceCodeParsed;
  try {
    const response = await axios.get(API_URL + paramString);
    // The Etherscan API returns OK / NOTOK
    if (response.data.message !== "OK") {
      console.log(response.data);
      throw new Error("Etherscan API returned NOTOK");
    }

    // On "sourceCode" Etherscan return 3 possible values:
    // 1. A string (on flattened contracts)
    // 2. An almost-valid JSON :( (on splitted verified contracts)
    // 3. A valid JSON (on _some_ splitted verified contracts)
    const sourceCode = response?.data?.result?.[0]?.SourceCode;
    if (!sourceCode) {
      throw new Error(
        "Contract Source Code is not valid. Is the Contract verified?"
      );
    }

    try {
      // Option 3. A valid JSON
      const parsedJson = JSON.parse(sourceCode);
      sourceCodeParsed = parsedJson?.[`${challenge.contractName}`]?.content;
    } catch (e) {
      if (sourceCode.slice(0, 1) === "{") {
        // Option 2. An almost valid JSON
        // Remove the initial and final { }
        const validJson = JSON.parse(sourceCode.substring(1).slice(0, -1));
        sourceCodeParsed =
          validJson?.sources[`contracts/${challenge.contractName}`]
            ?.content ??
          validJson?.sources[`./contracts/${challenge.contractName}`]
            ?.content;
      } else {
        // Option 1. A string
        sourceCodeParsed = sourceCode;
      }
    }

    if (!sourceCodeParsed) {
      throw new Error(
        `Contract Source Code is not valid. Are you sure you are submitting the ${challenge.contractName} contract address?`
      );
    }
    const path = `${__dirname}/../challenges/${challenge.name}`;
    const contractPath = `${path}/packages/foundry/contracts/download-${contractAddress}.sol`;
    fs.writeFileSync(contractPath, sourceCodeParsed);
    console.log(`📝 Contract saved at ${path}`);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

/**
 * Run the test from within the challenge repo against the downloaded contract
 * Delete the downloaded contract after testing so we don't have the prod server stacking up files with each submission
 */
export const testChallengeSubmission = async (config: SubmissionConfig) => {
  const { challenge, contractAddress } = config;

  try {
    console.log("🧪 Testing challenge submission...");
    const path = `${__dirname}/../challenges/${challenge.name}`;
    const contractName = challenge.contractName.replace(".sol", "");
    const contractPath = `download-${contractAddress}.sol:${contractName}`;
    const testCommand = `cd ${path} && CONTRACT_PATH="${contractPath}" yarn foundry:test --gas-report`;
    const { stdout, stderr } = await execute(testCommand);
    const removeContractCommand = `rm -f ${path}/packages/foundry/contracts/download-${contractAddress}.sol`;
    execute(removeContractCommand);
    return { stdout, stderr };
  } catch (e) {
    console.error("Something went wrong", JSON.stringify(e), "\n");
    throw e;
  }
};
