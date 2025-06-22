() => {
  function getChannelUser(channelId, slackBotToken) {
    const url = "https://slack.com/api/conversations.members";
    const options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url + "?channel=" + channelId, options);

    const result = JSON.parse(response.getContentText());
    if (!result.ok) {
      // Logger.error('API Error:', result.error);
      return {
        ok: false,
        message: "Response Error: " + result.error,
      };
    }
    Logger.log("Members fetched: " + result.members.length);
    return {
      ok: true,
      message: `Successfully fetch member in channel (id: ${channelId})`,
      value: filterMembers(result.members.sort(), slackBotToken),
    };
  }

  function getUserGroupMembers(usergroupId, slackBotToken) {
    var url = "https://slack.com/api/usergroups.users.list";
    var options = {
      method: "get",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      muteHttpExceptions: true,
    };

    var response = UrlFetchApp.fetch(
      url + "?usergroup=" + usergroupId,
      options
    );
    var result = JSON.parse(response.getContentText());
    if (!result.ok) {
      return {
        ok: false,
        message: "Failed getting group memeber: " + result.error,
      };
    }

    return {
      ok: true,
      message: "Successfully get group member",
      value: result.users,
    };
  }
};
