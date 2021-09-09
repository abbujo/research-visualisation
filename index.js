const express = require("express");
const { ApolloServer } = require("apollo-server-express");
const staple = require("staple-api");

const ontology = {
    file: "./docs/ontology.ttl" 
};

const config = {
    dataSources: {
        default: "defaultSource",
        defaultSource: {
            type: "mongodb",
            url: "mongodb+srv://abbu93:itsmeabbu20@cluster0.bafsc.mongodb.net/TestPyMongo", 
            dbName: "TestPyMongo",
            collectionName: "test",
            description: "MongoDB Atlas Demo instance"
        }
    }
};

async function Demo() {
    
    // creating an instance of Staple API

    const stapleApi = await staple(ontology, config);
    const schema = stapleApi.schema;
  
    // creating the list of all people and their names for FE indexing

    let people = []

    console.log("Fetching people's names...")
    await stapleApi.graphql('{ Subject { _id label } }').then((response) => {
        response.data.Subject.forEach(element => {
            people.push({id: element._id, text:element.label})
        });
        console.log("...all fetched!")
        });


    // exnabling FE, Staple API and people endpoint via express server

    const app = express();
    
    app.use(express.static("docs"))

    app.get('/subject', function (req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(people)
      })

    const server = new ApolloServer({
        schema
    });

    const path = "/graphql";
    server.applyMiddleware({ app, path });

    app.listen({ port: 5000 }, () =>
        console.log("🚀 Server ready")
    );
}

Demo()