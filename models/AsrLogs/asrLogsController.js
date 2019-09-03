MalibunCollection.ready('asrLogs', function () {

    var throttleChanged = _.throttle(function(builder,pagination){
        var rules = builder.queryBuilder('getRules');
        if (rules) {
            var result = builder.queryBuilder('getMongo');
            pagination.set({
                filters: result
            });
        }
    },2000);
    function querybuilderData(pagination){
        return function() {
            return {
                changed: function (builder) {
                    throttleChanged(builder,pagination);
                },
                rules: {},
                filters:[
                    {
                        id:'phone',
                        type:'string',
                        label:AsrLogs.schema.label('phone'),
                    },
                    {
                        id:'recognizedText',
                        type:'string',
                        label:AsrLogs.schema.label('recognize'),
                    },
                    {
                        id:'error',
                        type:'string',
                        label:AsrLogs.schema.label('error'),
                    },

                    new DateQuery({
                        mode:DateQuery.Mode.datetime.key,
                        id:`DATETIME(created)`,
                        label:`ДатаВремя`
                    }).filter(),

                    new DateQuery({
                        mode:DateQuery.Mode.date.key,
                        id:`DATE(created)`,
                        label:`Дата`
                    }).filter()
                ]
            };
        }
    };

    AsrLogsController = class AsrLogsController extends MalibunController {
        constructor() {
            super(AsrLogs);
            this.pagination = new Meteor.Pagination(this.collection, {
                itemTemplate: this.getTemplate('Row'),
                templateName: this.getTemplate('Index'),
                perPage: 10,
                auth: (skip, sub) => {
                    return this.collection.adminAuth(this.pagination, skip, sub);
                },
                table: {
                    class: "table",
                    //fields: [],
                    header: [
                        this.collection.schema.label('phone'),
                        this.collection.schema.label('created'),
                        this.collection.schema.label('topic'),
                        'Результаты',
                        'Запись',
                        'Ошибка'
                    ],
                    wrapper: "table-wrapper"
                },
                sort:{created:-1},
                availableSettings: {
                    sort: true,
                    filters: true
                },
                fastRender: true
            });
        }

        actionIndex() {
            var controller = this;
            return super.actionIndex().extends({
                waitOn: function () {
                    return []
                },
                data: function () {
                    return {
                        querybuilderData:querybuilderData(controller.pagination),
                    }
                },
                title: 'Логи ASR',
                rendered() {
                    controller.pagination.requestPage(1);
                }
            });
        }

        actionView() {
            return null;
        }

        actionCreate() {
            return null;
        }

        actionUpdate() {
            return null;
        }
    };

    asrLogsController = new AsrLogsController();
    asrLogsController.init();
});