function addReaction(channelId, messageTs, reactionId, slackBotToken) {
  var url = "https://slack.com/api/reactions.add";
  var payload = {
    channel: channelId,
    timestamp: messageTs,
    name: reactionId,
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
      message: "Successfully add reaction",
    };
  } else {
    return {
      ok: false,
      message: "Error: " + result.error,
    };
  }
}

function removeReaction(channelId, messageTs, reactionId, slackBotToken) {
  var url = "https://slack.com/api/reactions.remove";
  var payload = {
    channel: channelId,
    timestamp: messageTs,
    name: reactionId,
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
      message: "Successfully remove reaction",
    };
  } else {
    return {
      ok: false,
      message: "Error: " + result.error,
    };
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
  const numberWords = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ];

  for (const numberWord of numberWords) {
    if (reactionList.includes(numberWord)) {
      numberReactions.push(numberWord);
    }
  }
  resultList.push(...numberReactions);

  // sort any other reactions
  const usedReactions = new Set([REACTION_READ, ...numberReactions]);
  const otherReactions = reactionList
    .filter((reaction) => !usedReactions.has(reaction))
    .sort();

  resultList.push(...otherReactions);

  return resultList;
}

function getMentionedUsers(channelId, messageTs, slackBotToken) {
  const messageDetails = getMessageDetails(channelId, messageTs, slackBotToken);
  if (!messageDetails.ok) {
    return {
      ok: false,
      message: `Error: ${messageDetails.message}`,
    };
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
      message: "Error: " + channelMembersResult.message,
    };
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

  var uniqueToUsers = filterMembers(
    Array.from(new Set(toUsers)),
    slackBotToken
  );

  var uniqueCcUsers = filterMembers(
    Array.from(new Set(ccUsers)),
    slackBotToken
  );
  uniqueCcUsers = uniqueCcUsers.filter(
    (userId) => !uniqueToUsers.includes(userId)
  );
  // console.log(uniqueToUsers);
  // console.log(uniqueCcUsers);

  uniqueToUsers = uniqueToUsers.filter((userId) =>
    channelMembers.includes(userId)
  );
  uniqueCcUsers = uniqueCcUsers.filter((userId) =>
    channelMembers.includes(userId)
  );

  if (uniqueToUsers && uniqueCcUsers) {
    return {
      ok: true,
      message: "Successfully get mentioned users",
      value: {
        allUsers: [].concat(uniqueToUsers, uniqueCcUsers).sort(),
        toUsers: uniqueToUsers.sort() || [],
        ccUsers: uniqueCcUsers.sort() || [],
      },
    };
  } else {
    return {
      ok: false,
      message: "Failed to get mentioned users",
    };
  }
}

function getReactionUsers(channelId, messageTs, slackBotToken) {
  var url = "https://slack.com/api/reactions.get";
  var payload = {
    channel: channelId,
    timestamp: messageTs,
  };
  var options = {
    method: "get",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${slackBotToken}` },
    muteHttpExceptions: true,
  };
  var response = UrlFetchApp.fetch(
    url +
      "?" +
      Object.keys(payload)
        .map(function (key) {
          return key + "=" + payload[key];
        })
        .join("&"),
    options
  );

  const result = JSON.parse(response.getContentText());
  // console.log(result.message.reactions);

  var reactionUsersObj = {};
  result.message.reactions.forEach((data) => {
    reactionUsersObj[data.name] = data.users;
  });
  // console.log("reactionUsersObj:", reactionUsersObj);

  return {
    ok: true,
    message: "Successfully get reaction users.",
    value: reactionUsersObj,
  };
}
