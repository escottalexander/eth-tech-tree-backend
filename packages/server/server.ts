import express, { Express, Request, Response, json } from "express";
import https from "https";
import fs from "fs";
import cors from "cors";
import {
  validateChallengeSubmission,
  downloadContract,
  testChallengeSubmission,
  PORT,
  validateAddress
} from "./utils";
import { fetchChallenge, fetchChallenges } from "./services/challenge";
import { fetchUser } from "./services/user";

export const startServer = async () => {
  const app: Express = express();
  app.use(cors());
  app.use(json());

  // Define routes
  app.get("/", (req: Request, res: Response) => {
    res.send("Express + TypeScript Server");
  });

  /**
   * Fetch all the challenges
   */
  app.get("/challenges", async (req: Request, res: Response) => {
    const challenges = await fetchChallenges();
    return res.json({ challenges });
  });

  /**
   * Fetch a user by their address
   */
  app.get("/user/:address", validateAddress, async (req: Request, res: Response) => {
    console.log("GET /user/:address \n", req.params);
    const address = req.params.address;
    try {
      const user = await fetchUser(address);
      return res.json({ user });
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        return res.status(500).json({ error: e.message });
      } else {
        return res.status(500).json({ error: "Unexpected error occurred" });
      }
    }
  });

  /**
   * Challenge submission route temp setup as a GET to save us effort of firing POST requests during development
   * 1. Fetch the contract source code from Etherscan and save it into challenge repo
   * 2. Run the test from within the challenge repo against the downloaded contract
   * 3. Return the results
   */
  app.get(
    "/:challengeSlug/:network/:address",
    validateChallengeSubmission,
    async function (req: Request, res: Response) {
      console.log("GET /:challengeSlug/:network/:address \n", req.params);
      const { network, address } = req.params;
      const challengeSlug = req.params.challengeSlug;
      try {
        const challenge = await fetchChallenge(challengeSlug);
        const submissionConfig = { challenge, network, address };
        await downloadContract(submissionConfig);
        const result = await testChallengeSubmission(submissionConfig);
        return res.json({ result });
      } catch (e) {
        console.error(e);
        if (e instanceof Error) {
          return res.status(500).json({ error: e.message });
        } else {
          return res.status(500).json({ error: "Unexpected error occurred" });
        }
      }
    }
  );

  // Start server
  if (fs.existsSync("server.key") && fs.existsSync("server.cert")) {
    https
      .createServer(
        {
          key: fs.readFileSync("server.key"),
          cert: fs.readFileSync("server.cert"),
        },
        app
      )
      .listen(PORT, () => {
        console.log(`[server]: Server is running at http://localhost:${PORT}`);
      });
  } else {
    app.listen(PORT, () => {
      console.log(`[server]: Server is running at http://localhost:${PORT}`);
    });
  }
};
