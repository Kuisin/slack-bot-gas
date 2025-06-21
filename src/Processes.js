function processReactionRead(channelId, messageTs, slackBotToken) {
  if (!slackBotToken) {
    return {
      ok: false,
      message: "Token not exsits"
    }
  }

  // Get reactions from user properties
  const TRIGGER_REACTION_READ = "check_eyes";
  const REACTION_READ = "eyes";

  // Initialize reaction on start
  addReaction(channelId, messageTs, TRIGGER_REACTION_READ, slackBotToken);
  removeReaction(channelId, messageTs, REACTION_READ, slackBotToken);

  // Get details from message
  var mentionedUsersResult = getMentionedUsers(channelId, messageTs, slackBotToken);
  if (!mentionedUsersResult.ok) {
    return {
      ok: false,
      message: "Error: " + mentionedUsersResult.message
    }
  }

  const { allUsers: mentionedUsers } = mentionedUsersResult.value;
  addReaction(channelId, messageTs, REACTION_READ, slackBotToken);

  const reactionUsersResult = getReactionUsers(channelId, messageTs, slackBotToken);
  if (!reactionUsersResult.ok) {
    return {
      ok: false,
      message: "Error: " + reactionUsersResult.message
    }
  }
  const reactionUsers = reactionUsersResult.value;
  // console.log(REACTION_READ, reactionUsers[REACTION_READ]);

  const notReactionUserResult = filterNotReactionUsers(mentionedUsers, reactionUsers[REACTION_READ]);
  if (!notReactionUserResult.ok) {
    return {
      ok: false,
      message: "Error: " + notReactionUserResult.message
    }
  }
  const notReactionUser = notReactionUserResult.value;
  // console.log("notReactionUser:", notReactionUser);

  var threadText = ""
  if (notReactionUser.length === 0) {
    threadText = "全メンバーのリアクションが完了しています！"
  } else {
    threadText = notReactionUser.map(userId => `<@${userId}>`).join(" ") + `\nリアクション :${REACTION_READ}: をお願いします！`
  }

  // console.log(threadText);
  postToThread(channelId, messageTs, TRIGGER_REACTION_READ, threadText, slackBotToken);

  removeReaction(channelId, messageTs, TRIGGER_REACTION_READ, slackBotToken);

  return {
    ok: true,
    message: "Reaction checked and mentioned if missing.",
    value: {
      mentionedUsers: mentionedUsers,
      reactionUsers: reactionUsers[REACTION_READ],
      missingUsers: notReactionUser,
      sentMessage: threadText
    }
  }
}

function processReactionRead(channelId, messageTs, slackBotToken) {
  if (!slackBotToken) {
    return {
      ok: false,
      message: "Token not exsits"
    }
  }

  // Get reactions from user properties
  const TRIGGER_REACTION_READ = "check_eyes";
  const TRIGGER_READ = "eyes";

  // Initialize reaction on start
  addReaction(channelId, messageTs, TRIGGER_REACTION_READ, slackBotToken);
  removeReaction(channelId, messageTs, TRIGGER_READ, slackBotToken);

  // Get details from message
  var mentionedUsersResult = getMentionedUsers(channelId, messageTs, slackBotToken);
  if (!mentionedUsersResult.ok) {
    return {
      ok: false,
      message: "Error: " + mentionedUsersResult.message
    }
  }

  const { allUsers: mentionedUsers } = mentionedUsersResult.value;
  addReaction(channelId, messageTs, TRIGGER_READ, slackBotToken);

  const reactionUsersResult = getReactionUsers(channelId, messageTs, slackBotToken);
  if (!reactionUsersResult.ok) {
    return {
      ok: false,
      message: "Error: " + reactionUsersResult.message
    }
  }
  const reactionUsers = reactionUsersResult.value;
  // console.log(TRIGGER_READ, reactionUsers[TRIGGER_READ]);

  const notReactionUserResult = filterNotReactionUsers(mentionedUsers, reactionUsers[TRIGGER_READ]);
  if (!notReactionUserResult.ok) {
    return {
      ok: false,
      message: "Error: " + notReactionUserResult.message
    }
  }
  const notReactionUser = notReactionUserResult.value;
  // console.log("notReactionUser:", notReactionUser);

  var threadText = ""
  if (notReactionUser.length === 0) {
    threadText = "全メンバーのリアクションが完了しています！"
  } else {
    threadText = notReactionUser.map(userId => `<@${userId}>`).join(" ") + `\nリアクション :${TRIGGER_READ}: をお願いします！`
  }

  // console.log(threadText);
  postToThread(channelId, messageTs, TRIGGER_REACTION_READ, threadText, slackBotToken);

  removeReaction(channelId, messageTs, TRIGGER_REACTION_READ, slackBotToken);

  return {
    ok: true,
    message: "Reaction checked and mentioned if missing.",
    value: {
      mentionedUsers: mentionedUsers,
      reactionUsers: reactionUsers[TRIGGER_READ],
      missingUsers: notReactionUser,
      sentMessage: threadText
    }
  }
}
