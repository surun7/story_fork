import { NextResponse } from "next/server";

// 轻量配置探测：告知前端是否需要输入访问口令（ACCESS_CODE 配置与否）
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const accessCode = (process.env.ACCESS_CODE ?? "").trim();
  return NextResponse.json({ accessCodeRequired: accessCode.length > 0 });
}
