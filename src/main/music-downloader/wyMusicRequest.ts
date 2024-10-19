import { get } from '~/commons/request';
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
      artists: (song.ar?.map(s => s.name) || []).filter(t => !!t),
      pic: song.al?.picUrl || '',
    };
  }

  async getPlaylist(id: string, options: any) {
    const url = 'https://music.163.com/weapi/v6/playlist/detail'
    const data = {
      n: 1000,
      id,
      limit: 1000,
      offset: 0,
      total: true,
    }
    const encryptData = wyEncrypt(data);

    const detail = await get(url, {
      method: 'POST',
      form: encryptData,
      headers: options.headers || {},
      agent: options.agent || {},
    }).json();

    const playlist = (detail as any).playlist;

    return (playlist?.trackIds || []).map(t => t.id) as string[];
  }

  async getPlayUrl(id: string, options: any) {
    const url = 'https://music.163.com/weapi/song/enhance/player/url/v1?csrf_token=5b152b82889d4e481820ea32cb77cf60'
    const data = {
      csrf_token: '5b152b82889d4e481820ea32cb77cf60',
      encodeType:"aac",
      ids:`[${id}]`,
      level: "standard", // "lossless" // https://developer.music.163.com/st/developer/document?docId=9471ca8e25254ec4a2ce81876f85c895
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