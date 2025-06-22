() => {
  function postToThread(
    channelId,
    messageTs,
    icon = "bell",
    text,
    slackBotToken
  ) {
    if (!channelId || !text || !messageTs) {
      return {
        ok: false,
        message: "Missing channel Id or Text",
      };
    }

    var url = "https://slack.com/api/chat.postMessage";
    var payload = {
      channel: channelId,
      text: text,
      thread_ts: messageTs,
      username: "Reaction Reminder",
      icon_emoji: `:${icon}:`,
    };
    var options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    // console.log(result);

    if (result.ok) {
      return {
        ok: true,
        message: "Successfully send message to thread",
      };
    } else {
      return {
        ok: false,
        message: "Error: " + result.error,
      };
    }
  }

  function getMessageDetails(channelId, messageTs, slackBotToken) {
    if (!channelId || !messageTs) {
      return {
        ok: false,
        message: "Channel Id or MessageTs missing.",
      };
    }

    var threadUrl = "https://slack.com/api/conversations.replies";
    var threadPayload = {
      channel: channelId,
      ts: messageTs,
    };
    var options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    var threadResponse = UrlFetchApp.fetch(
      threadUrl +
        "?" +
        Object.keys(threadPayload)
          .map(function (key) {
            return key + "=" + threadPayload[key];
          })
          .join("&"),
      options
    );

    var threadResult = JSON.parse(threadResponse.getContentText());
    // console.log("threadResult:", threadResult);

    if (
      threadResult.ok &&
      threadResult.messages &&
      threadResult.messages.length > 0
    ) {
      var targetMessage = threadResult.messages.find(function (msg) {
        return msg.ts === messageTs;
      });

      if (targetMessage) {
        return {
          ok: true,
          message: "Successfully get message text.",
          value: targetMessage,
        };
      } else {
        return {
          ok: false,
          message: "Failed to get message text.",
          value: targetMessage,
        };
      }
    }

    return {
      ok: false,
      message: "Response Error: " + threadResult.error,
    };
  }
};
