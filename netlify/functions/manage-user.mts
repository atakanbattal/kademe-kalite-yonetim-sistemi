import type { Context, Config } from "@netlify/functions";
import { handleManageUserRequest } from "../../lib/manageUserHandler.js";

export default async (req: Request, _context: Context) => {
  const env = {
    VITE_SUPABASE_URL: Netlify.env.get("VITE_SUPABASE_URL") || "",
    VITE_SUPABASE_ANON_KEY: Netlify.env.get("VITE_SUPABASE_ANON_KEY") || "",
    SUPABASE_SERVICE_ROLE_KEY: Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  };

  return handleManageUserRequest(req, env);
};

export const config: Config = {
  path: "/api/manage-user",
};
