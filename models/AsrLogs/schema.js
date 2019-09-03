/**
 * @property {string} name
 * */
AsrLogs.schema = new SimpleSchema({
    topic:{type:String,label:'Тематика'},
    phone:{type:String,optional:true,defaultValue:null,label:'Телефон'},
    recognize:{type:[Object],label:'Результаты',optional:true,defaultValue:[]},
    'recognize.$.text':{type:String,label:'Текст',optional:true,defaultValue:null},
    'recognize.$.endOfUtt':{type:Boolean,optional:true,defaultValue:false,label:'Конец ввода'},

    recognizedText:{type:String,label:'Результаты (текст)',optional:true,defaultValue:null},
    error:{type:String,optional:true,defaultValue:null,label:'Ошибка'},
    created:Schemas.created('Время'),
    malibun_file_id:{type:String,optional:true,defaultValue:null}
});

if(Meteor.isServer){

}