/**
 * 提交前对密码做 MD5（十六进制）。后端会再次处理后再入库。
 */
import md5 from 'js-md5';

export function md5Hex(plain: string): string {
  return md5(plain);
}
