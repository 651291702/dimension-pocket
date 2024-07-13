// import { download, get, generateProxy, generateHeaders } from "~/commons/request"
import { get, download, generateHeaders, generateProxy } from '~/commons/request';
import wyEncrypt from './wyMusicEncrypt'


class WYMusicRequest {
  private oldCookieSet = new Set<string>();
  private cookie: string = ''
  constructor() {
  }

  

  async getSongDetail(id: string) {
    const url = 'https://music.163.com/weapi/v3/song/detail'
    const data = {
      csrf_token: '',
      c:JSON.stringify([{
        id
      }]),
      id,
    };
    const encryptData = wyEncrypt(data);

    const detail = await get(url, {
      method: 'POST',
      form: encryptData,
    }).json();

    const song = (detail as any).songs[0];
    return {
      name: song.name || '',
      artist: song.ar?.[0]?.name || '',
      pic: song.al?.picUrl || '',
    };
  }

  async getPlayUrl(id: string, options: any) {
    const url = 'https://music.163.com/weapi/song/enhance/player/url/v1?csrf_token=5b152b82889d4e481820ea32cb77cf60'
    const data = {
      csrf_token: '5b152b82889d4e481820ea32cb77cf60',
      encodeType:"aac",
      ids:`[${id}]`,
      level: "standard"
    }
    const encryptData = wyEncrypt(data);

    if (options?.headers?.cookie) {
      if (this.cookie != options.headers.cookie && !this.oldCookieSet.has(options.headers.cookie)) {
        this.oldCookieSet.add(this.cookie);
        this.cookie = options.headers.cookie;
      }
      options.headers.cookie = this.cookie;
    }
    const palydata = await get(url, {
      method: 'POST',
      form: encryptData,
      headers: options.headers || {},
      agent: options.agent || {},
    }).json();
    const play = (palydata as any).data?.[0] || { code: -5555 };
    return {
      url: play.url,
      type: play.type,
      code: play.code,
    };
  }
}

export default new WYMusicRequest();