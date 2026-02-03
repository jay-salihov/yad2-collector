// Minimal type declarations for Firefox WebExtension APIs used by this project.
// A full @types/webextension-polyfill can replace this later.

declare namespace browser {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number; url?: string };
      frameId?: number;
      id?: string;
    }

    function sendMessage(message: unknown): Promise<unknown>;

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
        ) => Promise<unknown> | undefined,
      ): void;
    };
  }

  namespace action {
    function setBadgeText(details: { text: string }): Promise<void>;
    function setBadgeBackgroundColor(details: {
      color: string;
    }): Promise<void>;
  }

  namespace downloads {
    function download(options: {
      url: string;
      filename?: string;
      saveAs?: boolean;
    }): Promise<number>;
  }
}
