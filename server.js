var express = require('express');
var express_graphql = require('express-graphql');
var { buildSchema } = require('graphql');
var fs = require("fs");
const fetch = require('node-fetch')
const moment = require('moment')

const RELOAD_DATA = false
var DATABASE = []
const EVENTS_API = 'https://raw.githubusercontent.com/tech-conferences/conference-data/master/conferences/2019/'
const EVENT_TYPES = ['android', 'python', 'cpp', 'css', 'data', 'devops', 'dotnet', 'elixir', 'general',
    'golang', 'graphql', 'ios', 'java', 'javascript', 'networking', 'php', 'clojure',
    'ruby', 'rust', 'scala', 'security', 'tech-comm', 'ux']

var schema = buildSchema(`
    type Query {
        loadEvents(id: Int): String
        event(id: Int!): Event
        events(city: String, country: String, type: String, within_days: Int): [Event]
    },
    type Event {
        id: Int
        type: String
        name: String
        url: String
        startDate: String
        endDate: String
        city: String
        country: String
        twitter: String
    }
`);

var loadEvents = () => {
    const urls = getUrls();
    Promise.all(urls.map(url =>
        fetch(url)
            .then(checkStatus)
            .then(parseJSON)
            .catch(error => console.warn('Looks like there was a problem!', error))
    ))
        .then(all_data => {
            console.warn("HERE");
            all_data.forEach((data, index) => {
                data.forEach((element) => {
                    element.id = generateID();
                    element.type = getEventType(index);
                    return element;
                })
                DATABASE = DATABASE.concat(data);
            })
            console.warn(DATABASE);
            console.warn("FINISHED");
            return DATABASE;
        })
        .then((data) => {
            saveDataToFile(data);
        })
}

var getEvent = (args) => {
    var id = args.id;
    return DATABASE.filter(event => {
        return event.id == id;
    })[0];
}

var defaultFilterFunc = (event, key, value) => {
    return event[key].toLowerCase().includes(value.toLowerCase())
}

var getEvents = (args) => {
    var out = []
    for (var key in args) {
        var value = args[key]
        var filterFunc = function (event, key, value) {
            return defaultFilterFunc(event, key, value)
        }
        if (key == 'within_days') {
            filterFunc = function (event, key, value) {
                return isWithinDays(event.startDate, value)
            }
        }
        if (out.length == 0) {
            out = DATABASE.filter(event => { return filterFunc(event, key, value) });
        } else {
            out = out.filter(event => { return filterFunc(event, key, value) });
        }
    }
    return out;
}

// ------------------------------------------
//  HELPER FUNCTIONS
// ------------------------------------------
let lastId = 1;

var generateID = () => {
    lastId++;
    return lastId;
}

var isWithinDays = (eventDate, value) => {
    var now = moment().utc();
    var then = moment(eventDate).utc();
    var diff = then.diff(now, 'days');
    if (diff >= 0 && Math.abs(diff) < value) {
        return true;
    }
    return false;
}

var checkStatus = (response) => {
    if (response.ok) {
        return Promise.resolve(response);
    } else {
        return Promise.reject(new Error(response.statusText));
    }
}

var parseJSON = (response) => {
    return response.json();
}

var getUrls = () => {
    var out = [];
    for (var type of EVENT_TYPES) {
        out.push(EVENTS_API + type + ".json");
    }
    console.warn(out);
    return out;
}

var getEventType = (index) => {
    return EVENT_TYPES[index]
}

var saveDataToFile = (data) => {
    var json = JSON.stringify(data);
    fs.writeFile('events_data.json', json, 'utf8', (err, data) => {
        if (err) {
            console.warn(err);
        }
        console.warn("Successfully Written to File.");
    });
}

var root = {
    loadEvents: loadEvents,
    event: getEvent,
    events: getEvents
};

// Create an express server and a GraphQL endpoint
var app = express();
app.use('/graphql', express_graphql({
    schema: schema,
    rootValue: root,
    graphiql: true
}));
app.listen(4000, () => {
    console.warn('Express GraphQL Server Now Running On localhost:4000/graphql');
    if (RELOAD_DATA) {
        loadEvents();
    } else {
        let rawData = fs.readFileSync('events_data.json');
        let processedData = JSON.parse(rawData);
        DATABASE = processedData
        console.warn("Event count:", DATABASE.length);
    }
});