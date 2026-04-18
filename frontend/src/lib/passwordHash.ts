/**
 * 提交前对密码做 SHA-256（十六进制），与后端比对存储一致。
 * 明文密码不进入 HTTP 请求体；仍需依赖 HTTPS 防窃听。
 */
export async function sha256Hex(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
