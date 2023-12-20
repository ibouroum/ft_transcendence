import { createAsyncThunk } from "@reduxjs/toolkit";
import { apiRequest } from "../../../../core/utils/apiRequest";
import { RootState } from "../../../../core";
import { leaderboardType } from "../statsType";

const getLeaderboard = createAsyncThunk(
  "profile/leaderboard",
  async (_, { getState }): Promise<leaderboardType> => {
    try {
      const token = (getState() as RootState).auth.token;
      const { data: players }: { data: leaderboardType } = await apiRequest(
        `/game/leaderBoard`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log(players);
      return players;
    } catch (error) {
      console.log("error leaderboard fetching", error);
      throw error;
    }
  }
);

export { getLeaderboard };
