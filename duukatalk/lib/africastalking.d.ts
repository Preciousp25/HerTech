declare module "africastalking" {
  interface SmsSendOptions {
    to: string | string[];
    message: string;
    from?: string;
    senderId?: string;
  }

  interface AfricasTalkingClient {
    SMS: {
      send: (options: SmsSendOptions) => Promise<unknown>;
    };
  }

  function AfricasTalking(credentials: {
    apiKey: string;
    username: string;
  }): AfricasTalkingClient;

  export default AfricasTalking;
}
