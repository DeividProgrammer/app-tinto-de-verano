export default [
  {
    match: {
        predicate: {
            type: "uri",
            value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        },
        object: {
            type: "uri",
            value: "http://xmlns.com/foaf/0.1/OnlineAccount",
        },
    },
    callback: {
      url: "http://mu-weekly_counter/new-weekly-counter",
      method: "POST",
    },
    options: {
      resourceFormat: "v0.0.1",
      gracePeriod: 1000,
      foldEffectiveChanges: true,
      ignoreFromSelf: true,
    },
  }
];

