const Discord 	= require('discord.js');
const Sequelize = require('sequelize');
const fs 	= require('fs');

const client = new Discord.Client();
const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './pwndb.sqlite'
});
const Op = Sequelize.Op;


const CONFIG_PATH = "./config.json";
// Read in config JSON file to Object
var config;
try {
	const jsonString = fs.readFileSync(CONFIG_PATH);
	config = JSON.parse(jsonString);
	console.log(config);
	console.log(`Bot loaded with prefix: ${config.prefix} and reaction: ${config.reaction}`);
} catch (err) {
	console.log(err);
}

var PWN_EMOJI_NAME = config.reaction;
var PREFIX = config.prefix;
const banlist = config.banlist;
const BOT_MODERATION_ROLE = "Administrator";
const FILIPE_ID = '650073734446579736';

const Points = sequelize.define('points', {
	id: {
		type: Sequelize.STRING,
		primaryKey: true,
		unique: true,
	},
	points : {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		allowNull: false,
	},
});

function checkForBan(id) {
	for (i = 0; i < banlist.length; i++) {
		if (banlist[i].id === id) { return true; }
	}
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	Points.sync();
	client.user.setActivity('for PWNAGE', { type: 'WATCHING' });
	
});

client.on('message', async msg => {
	if (!msg.guild) return;
	const isAdmin = (msg.member.roles.cache.find(r => r.name === BOT_MODERATION_ROLE) || msg.author.id === FILIPE_ID) ? true : false;
	if(msg.content.startsWith(PREFIX)) {
		const input = msg.content.slice(PREFIX.length).split(' ');
		const command = input.shift();
		const commandArgs = input.join(' ');
		if (command === 'status' && msg.author.id === FILIPE_ID) msg.reply('All good boss!');
		if (command === 'points') {
			const splitArgs = commandArgs.split(' ');
			const user = splitArgs.shift();
			const userId = user.substring(3, user.length-1);
			const result = await Points.findOne({ where: { id: userId } });
			
			if (result) {
				msg.channel.send(`${user} has ${result.points} points :)`);
			} else {
				msg.channel.send(`${user} has 0 points :(`);
				try {
					const newId = await Points.create({ id: userId, points: 0 });
				} catch (e) {
					console.log('Something went wrong creating a User ID:');
					if (e.name === 'SequelizeUniqueConstraintError') {
						console.log('Tried to create Id that already exists.');
					}
				}				
			}
		
		}
		if (command === 'remove' && isAdmin) {
			const splitArgs = commandArgs.split(' ');
			const user = splitArgs.shift();
			const userId = user.substring(3, user.length-1);
			const numPtsToRemove = splitArgs.shift();
			const result = await Points.findOne({ where: { id: userId } });
			if (result) {
				const newPts = ( (result.points - numPtsToRemove) < 0 ) ? 0 : (result.points - numPtsToRemove);
				const affected = await Points.update({ points: newPts }, { where: { id: userId } });
				if (affected > 0) {
					msg.channel.send(`Successfully removed ${numPtsToRemove} from ${user}`);
				} else {
					msg.channel.send(`Failed to remove points from ${user}. This is probably filipe's fault.`);
				}
			} else {
				msg.channel.send(`${user} has no points.`);
			}
		}
		if (command === 'set-reaction' && isAdmin) {
			const splitArgs = commandArgs.split(' ');
			const emojiName = splitArgs.shift();
			msg.channel.send(`Changing reaction emoji from :${PWN_EMOJI_NAME}: to :${emojiName}:!`);
			PWN_EMOJI_NAME = emojiName;
			config.reaction = emojiName
			fs.writeFile(CONFIG_PATH, JSON.stringify(config), (err) => {
				console.log(config.reaction);
				if (err) console.log('Error writing to config: ', err);
			})
		}
		
		if (command === 'set-alt' && isAdmin) {
			const splitArgs = commandArgs.split(' ');
			const emojiName = splitArgs.shift();
			msg.channel.send(`Changing alt-reaction from :${config['alt-reaction']}: to :${emojiName}:!`);
			config['alt-reaction'] = emojiName;
			fs.writeFile(CONFIG_PATH, JSON.stringify(config), (err) => {
				console.log(config.reaction);
				if (err) console.log('Error writing to config: ', err);
			})
		}

		if (command === 'set-prefix' && isAdmin) {
			const splitArgs = commandArgs.split(' ');
			const newPrefix = splitArgs.shift();
			msg.channel.send(`Changing prefix from ${PREFIX} to ${newPrefix}!`);
			PREFIX = newPrefix;
			config.prefix = newPrefix;
			fs.writeFile(CONFIG_PATH, JSON.stringify(config), (err) => {
				console.log(config.prefix);
				if (err) console.log('Error writing to config: ', err);
			})
		}
		if (command === 'prefix') msg.channel.send(`Current prefix is ${PREFIX}`);
		if (command === 'reaction') msg.channel.send(`Current reaction is :${PWN_EMOJI_NAME}:`);
		if (command === 'leaderboard') {
			const results = await Points.findAll({ where: { points: { [Op.gt]: 0 } } });
			if (results) {
				results.sort((a, b) => (a.points > b.points) ? 1 : -1);
			} else {
				console.log("Failure in top command!");
			}
			var rank = 1;
			var message = `TOP PWNERS:\n===========`;
			for (i = results.length; i > results.length - 4; i--) {
				const thisResult = results[i];
				if (!thisResult) continue;
				message += `\n ${rank}. <@!${results[i].dataValues.id}> : ${results[i].dataValues.points} pwns`;
				rank += 1;
			}
			msg.channel.send(message);
		}
	}
});

client.on('messageReactionAdd', async (reaction, user) => {
	if (checkForBan(user.id)) { return; }
	if (reaction.partial) {
		try {
			await reaction.fetch();
		} catch (error) {
			console.log('Something went wrong when fetching the message: ' , erro);
			return;
		}
	}

	if ((reaction.emoji.name == PWN_EMOJI_NAME || reaction.emoji.name == config["alt-reaction"]) && reaction.message.author.id != user.id) {
		const result = await Points.findOne({ where: { id: reaction.message.author.id } });
		if (result) {
			console.log("Found record");
			const new_points = result.points + 1;
			const affected = await Points.update({ points: new_points }, { where: { id: reaction.message.author.id } });
			if (affected > 0) {
			 	console.log(`${reaction.message.author} just got a pwn point!! EPIC!!`);
			} else {
				reaction.message.channel.send(`Failed to give ${reaction.message.author} a pwn point! Yell at filipe!`);
			}
		} else {
			try { 
				const newId = await Points.create({ id: reaction.message.author.id, points: 1 });
			}
			catch (e) {
				console.log(`Something went wrong creating a User ID: ${e}`);
				if (e.name === 'SequelizeUniqueConstraintError') {
					console.log('Tried to create Id that already exists.');
				}
			}
		}
	} 

});


client.login(config.token);
