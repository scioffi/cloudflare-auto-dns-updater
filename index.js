const fs = require("fs");
const publicIP = require("public-ip");
const axios = require("axios");

let dnsList, secrets, oldIPAddress

try {
    dnsList = JSON.parse(fs.readFileSync("dns.json"));
    secrets = JSON.parse(fs.readFileSync("secrets.json"));
    oldIPAddress = fs.readFileSync("address.txt", "utf-8").trim();
} catch (err) {
    console.error("Unable to open a config file");
    console.error(err)
    process.exit(1)
}

const cf = require("cloudflare")({
    token: secrets.cloudflare_api_token
});

(async () => {
    const newIPAddress = await publicIP.v4();

    if(newIPAddress === oldIPAddress) {
        console.warn("no ip change");
        process.exit(0)
    }

    dnsList.forEach((website) => {
        cf.dnsRecords.browse(website.zone_id).then((cf_records) => {
            console.log("===========================================================");
            console.log(cf_records);
            console.log("===========================================================");
            website.records.forEach((record) => {
                const combinedName = record !== "" ? record + "." + website.domain : website.domain;
                const dns_record = cf_records.result.filter((row) => row.name === combinedName);
                if (dns_record.length === 1) {
                    const record_id = dns_record[0].id;
                    axios({
                        method: "PATCH",
                        url: `https://api.cloudflare.com/client/v4/zones/${website.zone_id}/dns_records/${record_id}`,
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${secrets.cloudflare_api_token}`
                        },
                        data: {
                            "content": newIPAddress
                        }
                    }).then((res) => {
                        console.log("updated");
                    }).catch(e => console.error(e));
                } else {
                    console.error(dns_record.length + "::" + combinedName);
                }
            });
        });
    });
    try {
        fs.writeFileSync("address.txt", newIPAddress);
        console.log("New IP Address saved")
    } catch (err) {
        console.error("Unable to save new IP Address");
        console.error(err)
        process.exit(2)
    }

})();
