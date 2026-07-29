declare module 'telnyx' {
  class Telnyx {
    constructor(apiKey: string);
    calls: {
      create(params: any): Promise<any>;
      retrieve(callId: string): Promise<any>;
      list(params?: any): Promise<{ data: any[] }>;
      hangup(params: any): Promise<any>;
      hold(params: any): Promise<any>;
      transfer(params: any): Promise<any>;
      sendDtmf(params: any): Promise<any>;
      speak(params: any): Promise<any>;
    };
    recordings: {
      fetch(recordingSid: string): Promise<any>;
    };
    messages: {
      create(params: any): Promise<any>;
    };
    validateRequest(signature: string, url: string, params: any, authToken: string): boolean;
  }

  export default Telnyx;
}
