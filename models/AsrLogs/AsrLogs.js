/**
 * @property {string}
 * */
AsrLogsModel = class AsrLogsModel extends MalibunModel{
    get recognizeHTML(){
        if(_.isEmpty(this.recognize))
            return '<span color="#c3c3c3">-</span>';
        return _.chain(this.recognize)
            .map((asrItem)=>{
                if(!asrItem.endOfUtt)
                    return `<span style="color:#c3c3c3">${asrItem.text}</span>`;
                else
                    return `<span>${asrItem.text}</span>`;
            })
            .value()
            .join('<br/>');
    }
};

AsrLogs = new MalibunCollection('asrLogs',
{
    modelClass:AsrLogsModel,
    permissions:{
        group:{
            [Roles.ROLE_ADMIN]:'rw',
        }
    }
});

/**
 * @method
 * @name AsrLogs#findOne
 * @param {object} selector - <p>A query describing the documents to find</p>
 * @returns AsrLogsModel
 */