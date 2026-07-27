declare module 'telnyx' {
  class Telnyx {
    constructor(apiKey: string);
    calls: {
      create(params: any): Promise<any>;
      retrieve(callId: string): Promise<any>;
      list(params?: any): Promise<{ data: any[] }>;
      hangup(callId: string): Promise<any>;
      hold(callId: string, params: any): Promise<any>;
      transfer(callId: string, params: any): Promise<any>;
      sendDtmf(callId: string, params: any): Promise<any>;
      speak(callId: string, params: any): Promise<any>;
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
