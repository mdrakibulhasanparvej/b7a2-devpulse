import CookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import globalErrorHandler from "./middleware/globalErrorHandler"; // ✅ space সরানো
import { userRoutes } from "./modules/user/user.route";
import { authRoutes } from "./modules/auth/auth.route";
import { issueRoutes } from "./modules/issue/issue.route";

const app: Application = express();

app.use(CookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*", // ✅ সব origin allow
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.options("*", cors()); // ✅ preflight handle

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "DevPulse",
    author: "API RUNING",
  });
});

app.use("/api/auth", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/issues", issueRoutes);
app.use(globalErrorHandler);

export default app;
