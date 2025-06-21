const TRIGGER_REACTION_READ = "check_eyes";
const TRIGGER_REACTION_ANY = "check_any";
const REACTION_READ = "eyes";

function processReactionRead(channelId, messageTs, slackBotToken) {
  if (!slackBotToken) {
    return {
      ok: false,
      message: "Token not exsits"
    }
  }

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

function processReactionAny(channelId, messageTs, slackBotToken) {
  if (!slackBotToken) {
    return {
      ok: false,
      message: "Token not exsits"
    }
  }

  // Initialize reaction on start
  addReaction(channelId, messageTs, TRIGGER_REACTION_ANY, slackBotToken);

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
  console.log("reactionUsers:", reactionUsers);

  const reactionList = orderReaction(Object.keys(reactionUsers).map(reaction => reaction !== REACTION_READ));
  console.log("reactionList:", reactionList);

  const reactionUsersFlat = [];
  reactionList.forEach(reaction => {
    removeReaction(channelId, messageTs, reaction, slackBotToken);
    reactionUsersFlat.push(...reactionUsers[reaction]);
  });
  
  const notReactionUserResult = filterNotReactionUsers(mentionedUsers, new Set(reactionUsersFlat));
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
    threadText = notReactionUser.map(userId => `<@${userId}>`).join(" ") + `\nリアクション（${reactionList.map(reaction => ` :${reaction}: `).join("or")}）をお願いします！`
  }

  // console.log(threadText);
  postToThread(channelId, messageTs, TRIGGER_REACTION_ANY, threadText, slackBotToken);
  removeReaction(channelId, messageTs, TRIGGER_REACTION_ANY, slackBotToken);

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