import type { LoginQrcodeResponse } from "../contracts";

export const getQrcodeRenderContent = (payload: LoginQrcodeResponse): string => payload.qrcodeImgContent;
