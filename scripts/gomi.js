const { ClarifaiStub, grpc } = require("clarifai-nodejs-grpc");
const fs = require("fs");

const stub = ClarifaiStub.grpc();

const metadata = new grpc.Metadata();
const api_key = "8870616942bd430ba6b4384ef254208a";
metadata.set("authorization", "Key " + api_key);

module.exports = (robot) => {
  const onfile = (res, file) => {
    res.download(file, (path) => {
      const imageBytes = fs.readFileSync(path, { encoding: "base64" }); // ファイルを読み込んでbase64エンコード
      stub.PostModelOutputs( // Clarifai APIの呼び出し
        {
          model_id: "trash-judge",  // 画像認識モデルのIDを指定
          inputs: [{ data: { image: { base64: imageBytes } } }]  // base64エンコードした画像データを入力として設定
        },
        metadata,
        (err, response) => {  // コールバック関数
          if (err) {
            res.send("Error: " + err);  // 何かエラーがあればエラーメッセージを返す
            return;
          }

          if (response.status.code !== 10000) {  // ステータスコードが10000以外の場合はエラーメッセージを返す
            res.send("Received failed status: " + response.status.description + "\n" + response.status.details + "\n" + response.status.code);
            return;
          }

          //これ以降が正常な場合の処理
          let result = "";
          for (const c of response.outputs[0].data.concepts) {
            result += c.name + ": " + c.value + "\n";
          }

          // 画像認識結果に基づいて異なるテキストを表示
          let message = "Default message.もしくはエラー。";
          if (response.outputs[0].data.concepts.some(c => c.name === "shigenA" && c.value > 0.6)) {
            message = "このごみは資源Aに分類されます。写真、もしくは油などで汚れている場合はよく洗うか、もやすごみとしてごみ出ししてください。縦・横・高さのいずれか一辺の長さが50センチメートルを超えるものは「粗大ごみ」になります。ボタン電池は処理ができないので、販売店の回収ボックスまでお願いします。";
          } else if (response.outputs[0].data.concepts.some(c => c.name === "shigenB" && c.value > 0.6)) {
            message = "このごみは資源Bに分類されます。ペンキ缶や一斗缶はもやすごみとして出してください。ペットボトルのラベルとキャップは資源Cとして出してください。";
          } else if (response.outputs[0].data.concepts.some(c => c.name === "shigenC" && c.value > 0.6)) {
            message = "このごみは資源Cに分類されます。油などで汚れている場合はよく洗うか、もやすごみとしてごみ出ししてください。";
          } else if (response.outputs[0].data.concepts.some(c => c.name === "moyasu" && c.value > 0.6)) {
            message = "このごみはもやすごみに分類されます。";
          }

          res.send(result + "\n" + message);
        }
      );
    });
  };

  robot.respond('file', (res) => {  // ファイルがアップロードされたときの処理
    onfile(res, res.json);
  });
};
