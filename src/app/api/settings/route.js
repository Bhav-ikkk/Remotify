import { z } from "zod";
import {
  getAppSettings,
  saveAppSettings,
} from "@/services/settings";

const settingsUpdateSchema = z.object({
  aiApiKey: z.string().optional(),
  targetProfile: z.string().max(20000).optional(),
  maxJobs: z.number().int().min(1).max(5000).optional(),
  minMatchScore: z.number().min(0).max(100).optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  zyteApiKey: z.string().optional(),
  zyteProjectId: z.string().optional(),
});

export async function GET() {
  try {
    const settings = await getAppSettings({ redact: true });
    return Response.json({ success: true, settings });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Failed to load settings.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = settingsUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: "Invalid settings payload.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const settings = await saveAppSettings(parsed.data);
    return Response.json({
      success: true,
      message: "Settings saved successfully.",
      settings,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Failed to save settings.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
