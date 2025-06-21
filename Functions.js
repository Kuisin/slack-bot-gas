function addReaction(channelId, messageTs, reactionId, slackBotToken) {
  var url = "https://slack.com/api/reactions.add";
  var payload = {
    channel: channelId,
    timestamp: messageTs,
    name: reactionId
  };
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${slackBotToken}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText())
  // console.log(result);

  if (result.ok) {
    return {
      ok: true,
      message: "Successfully add reaction"
    }
  } else {
    return {
      ok: false,
      message: "Error: " + result.error
    }
  }
}

function removeReaction(channelId, messageTs, reactionId, slackBotToken) {
  var url = "https://slack.com/api/reactions.remove";
  var payload = {
    channel: channelId,
    timestamp: messageTs,
    name: reactionId
  };
  var options = {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${slackBotToken}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText())
  // console.log(result);

  if (result.ok) {
    return {
      ok: true,
      message: "Successfully remove reaction"
    }
  } else {
    return {
      ok: false,
      message: "Error: " + result.error
    }
  }
}

function orderReaction(reactionList = []) {
  var resultList = [];

  // add default read reaction on top
  const REACTION_READ = "eyes";
  if (reactionList.includes(REACTION_READ)) {
    resultList.push(REACTION_READ);
  }

  // order number reaction
  const numberReactions = [];
  const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  
  for (const numberWord of numberWords) {
    if (reactionList.includes(numberWord)) {
      numberReactions.push(numberWord);
    }
  }
  resultList.push(...numberReactions);

  // sort any other reactions
  const usedReactions = new Set([REACTION_READ, ...numberReactions]);
  const otherReactions = reactionList
    .filter(reaction => !usedReactions.has(reaction))
    .sort();
  
  resultList.push(...otherReactions);

  return resultList
}

function postToThread(channelId, messageTs, icon = "bell", text, slackBotToken) {
  if (!channelId || !text || !messageTs) {
    return {
      ok: false,
      message: "Missing channel Id or Text"
    }
  }

  var url = "https://slack.com/api/chat.postMessage";
  var payload = {
      channel: channelId,
      text: text,
      thread_ts: messageTs,
      username: "Reaction Reminder",
      icon_emoji: `:${icon}:`
  };
  var options = {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: `Bearer ${slackBotToken}` },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText())
  // console.log(result);

  if (result.ok) {
    return {
      ok: true,
      message: "Successfully send message to thread"
    }
  } else {
    return {
      ok: false,
      message: "Error: " + result.error
    }
  }
}

function getChannelUser(channelId, slackBotToken) {
    const url = 'https://slack.com/api/conversations.members';
    const options = {
        method: 'get',
        contentType: 'application/json',
        headers: { Authorization: `Bearer ${slackBotToken}` },
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url + '?channel=' + channelId, options);

    const result = JSON.parse(response.getContentText());
    if (!result.ok) {
        // Logger.error('API Error:', result.error);
        return {
          ok: false,
          message: "Response Error: " + result.error
        };
    }
    Logger.log("Members fetched: "+result.members.length);
    return {
      ok: true,
      message: `Successfully fetch member in channel (id: ${channelId})`,
      value: filterMembers(result.members.sort(), slackBotToken)
    }
}

function getMessageDetails(channelId, messageTs, slackBotToken) {
  if (!channelId || !messageTs) {
    return {
      ok: false,
      message: "Channel Id or MessageTs missing."
    }
  }

  var threadUrl = "https://slack.com/api/conversations.replies";
  var threadPayload = {
    channel: channelId,
    ts: messageTs
  };
  var options = {
    method: "get",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${slackBotToken}` },
    muteHttpExceptions: true
  };
  
  var threadResponse = UrlFetchApp.fetch(threadUrl + "?" +
    Object.keys(threadPayload)
      .map(function(key) { return key + "=" + threadPayload[key]; })
      .join("&"), options);
  
  var threadResult = JSON.parse(threadResponse.getContentText());
  // console.log("threadResult:", threadResult);
  
  if (threadResult.ok && threadResult.messages && threadResult.messages.length > 0) {
    var targetMessage = threadResult.messages.find(function(msg) {
      return msg.ts === messageTs;
    });
    
    if (targetMessage) {
      return {
        ok: true,
        message: "Successfully get message text.",
        value: targetMessage
      };
    } else {
      return {
        ok: false,
        message: "Failed to get message text.",
        value: targetMessage
      }
    }
  }

  return {
    ok: false,
    message: "Response Error: " + threadResult.error
  };
}

function getMentionedUsers(channelId, messageTs, slackBotToken) {
  const messageDetails = getMessageDetails(channelId, messageTs, slackBotToken);
  if (!messageDetails.ok) {
    return {
      ok: false,
      message: `Error: ${messageDetails.message}`
    }
  }
  
  var toUsers = [];
  var ccUsers = [];

  var hasCc = false;
  var originalText = messageDetails.value.text;
  var toText = messageDetails.value.text;
  var ccText = "";

  var ccIndex = originalText.search(/\bcc\b/i);
  if (ccIndex !== -1) {
    hasCc = true;
    toText = originalText.substring(0, ccIndex);
    ccText = originalText.substring(ccIndex + 2);
  }

  const channelMembersResult = getChannelUser(channelId, slackBotToken);
  if (!channelMembersResult.ok) {
    return {
      ok: false,
      message: "Error: " + channelMembersResult.message
    }
  }

  const channelMembers = channelMembersResult.value;
  if (originalText.includes("<!channel>")) {
    if (toText.includes("<!channel>")) {
      toUsers.push.apply(toUsers, channelMembers);
    }
    if (ccText.includes("<!channel>")) {
      ccUsers.push.apply(ccUsers, channelMembers);
    }
  }

  // Process TO users
  var regexGroup = /<!subteam\^(\w+)>/g;
  var matchGroup;
  while ((matchGroup = regexGroup.exec(toText)) !== null) {
    var groupMembers = getUserGroupMembers(matchGroup[1], slackBotToken);
    if (groupMembers.ok) {
      // console.log(groupMembers.message);
      toUsers.push.apply(toUsers, groupMembers.value);
    } else {
      console.log("Error: " + groupMembers.message);
    }
  }

  var regex = /<@(\w+)>/g;
  var match;
  while ((match = regex.exec(toText)) !== null) {
    toUsers.push(match[1]);
  }

  // Process CC users
  if (hasCc) {
    var regexGroup = /<!subteam\^(\w+)>/g;
    var matchGroup;
    while ((matchGroup = regexGroup.exec(ccText)) !== null) {
      var groupMembers = getUserGroupMembers(matchGroup[1], slackBotToken);
      if (groupMembers.ok) {
        // console.log(groupMembers.message);
        ccUsers.push.apply(ccUsers, groupMembers.value);
      } else {
        console.log("Error: " + groupMembers.message);
      }
    }

    var regex = /<@(\w+)>/g;
    var match;
    while ((match = regex.exec(ccText)) !== null) {
      ccUsers.push(match[1]);
    }
  }

  var uniqueToUsers = filterMembers(Array.from(new Set(toUsers)), slackBotToken);

  var uniqueCcUsers = filterMembers(Array.from(new Set(ccUsers)), slackBotToken);
  uniqueCcUsers = uniqueCcUsers.filter(userId => !uniqueToUsers.includes(userId));
  // console.log(uniqueToUsers);
  // console.log(uniqueCcUsers);

  uniqueToUsers = uniqueToUsers.filter(userId => channelMembers.includes(userId));
  uniqueCcUsers = uniqueCcUsers.filter(userId => channelMembers.includes(userId));

  if (uniqueToUsers && uniqueCcUsers) {
    return {
      ok: true,
      message: "Successfully get mentioned users",
      value: {
        allUsers: [].concat(uniqueToUsers, uniqueCcUsers).sort(),
        toUsers: uniqueToUsers.sort() || [],
        ccUsers: uniqueCcUsers.sort() || []
      }
    }
  } else {
    return {
      ok: false,
      message: "Failed to get mentioned users"
    }
  }
}

function getUserGroupMembers(usergroupId, slackBotToken) {
  var url = "https://slack.com/api/usergroups.users.list";
  var options = {
    method: "get",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${slackBotToken}` },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url + "?usergroup=" + usergroupId, options);
  var result = JSON.parse(response.getContentText());
  if (!result.ok) {
    return {
      ok: false,
      message: "Failed getting group memeber: "+result.error
    };
  }
  
  return {
    ok: true,
    message: "Successfully get group member",
    value: result.users
  };
}

function getReactionList() {

}

function getReactionUsers(channelId, messageTs, slackBotToken) {
  var url = "https://slack.com/api/reactions.get";
  var payload = {
    channel: channelId,
    timestamp: messageTs
  };
  var options = {
    method: "get",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${slackBotToken}` },
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url +
    "?" +
    Object.keys(payload)
      .map(function (key) { return key + "=" + payload[key]; })
      .join("&"), options);
  
  const result = JSON.parse(response.getContentText())
  // console.log(result.message.reactions);

  var reactionUsersObj = {};
  result.message.reactions.forEach(data => {
    reactionUsersObj[data.name] = data.users
  })
  // console.log("reactionUsersObj:", reactionUsersObj);

  return {
    ok: true,
    message: "Successfully get reaction users.",
    value: reactionUsersObj
  }
}

function filterNotReactionUsers(mentionedUsers = [], reactionUsers = []) {
  if (!mentionedUsers || mentionedUsers.length === 0) {
    return {
      ok: false,
      message: "Mentioned User does not exist or empty"
    }
  }

  var notReactionUser = []
  mentionedUsers.forEach(userId => {
    if (!reactionUsers.includes(userId)) {
      notReactionUser.push(userId);
    }
  })

  return {
    ok: true,
    message: "Successfully filtered users",
    value: notReactionUser
  }
}