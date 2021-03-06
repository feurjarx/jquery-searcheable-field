const memoize = (function() {

    let cache = {};

    return (cacheKey: string, asyncFn: Function) => {

        const defer = $.Deferred();
        const uid = asyncFn.toString().length + '_';
        const cacheValue = cache[uid + cacheKey];
        if (cacheValue) {

            defer.resolve(cacheValue, cacheKey, true);

        } else {

            let customArgs: Array<any>;

            let successAsyncFn = function(v) {
                // this is uid
                cache[this + cacheKey] = v;

                const baseArgs = [v, cacheKey, false];
                customArgs = [].slice.call(arguments, 1);
                defer.resolve.apply(defer, baseArgs.concat(customArgs));
            };

            successAsyncFn = successAsyncFn.bind(uid);
            asyncFn(successAsyncFn, function() {
                // error
                customArgs = [].slice.call(arguments, 0);
                defer.reject.apply(defer, customArgs);
            });
        }

        return defer;
    }
}());


$(() => {

    $.fn.searchable = function (listeners: {[key: string]: Function}) {

        return this.each((_, elem) => {

            const KeyCodeEnum = $.ui.keyCode;

            const hintsBlockClear = ($hintsBlock: JQuery) => {
                $hintsBlock.find('.hint').removeClass('active');
            };

            let activeHintPosition: number;

            $(elem)
                .keydown((event: KeyboardEvent) => {

                    let $field = $(event.target);
                    let $hintsBlock = $field.prev('.hints-block');
                    if (!$hintsBlock.is(':empty')) {

                        let $hints = $hintsBlock.find('.hint');
                        let hintsLength = $hints.length;

                        switch (event.keyCode) {
                            case KeyCodeEnum.ENTER:
                                $($hints.get(activeHintPosition)).trigger('click');
                                break;

                            case KeyCodeEnum.UP:

                                hintsBlockClear($hintsBlock);
                                activeHintPosition = activeHintPosition ? activeHintPosition - 1 : hintsLength - 1;
                                $hints.get(activeHintPosition).classList.add('active');

                                break;

                            case KeyCodeEnum.DOWN:

                                hintsBlockClear($hintsBlock);
                                activeHintPosition = (activeHintPosition + 1) % hintsLength;
                                $hints.get(activeHintPosition).classList.add('active');

                                break;

                            default:
                        }
                    }
                })
                .keyup((event: KeyboardEvent) => {

                    if (event.key.length === 1 || event.keyCode === KeyCodeEnum.BACKSPACE) {

                        let $field = $(event.target);
                        let $hintsBlock = $field.prev('.hints-block');

                        const searchText = $field.val();
                        if (searchText.length > 1) {

                            $hintsBlock.empty();
                            $hintsBlock.addClass('spin');

                            const httpCall = memoize(searchText, (cache: Function, reject: Function) => {
                                const searchSuccess = hints => cache(hints);
                                const searchError = () => reject();
                                listeners['search'](searchText, searchSuccess, searchError);
                            });

                            httpCall.always(() => {
                                $hintsBlock.removeClass('spin');
                            });

                            httpCall.then((hints, httpCallSearchText) => {

                                // is still actual?
                                if (searchText === httpCallSearchText) {

                                    $hintsBlock.empty();
                                    activeHintPosition = -1;
                                    if ($field.is(':focus')) {

                                        let counter = 0;
                                        hints.forEach((hint: { title: string; [key: string]: any }) => {

                                            const patternText = httpCallSearchText.replace(invalidSymbolsRegExp, '');

                                            let matchText = '';
                                            const match = hint.title.match(new RegExp(httpCallSearchText, 'gi'));
                                            if (match) {
                                                matchText = match[0];
                                            } else {
                                                throw new Error('Hint title: ' + hint.title + ' | ' + ' httpCallSearchText = ' + httpCallSearchText + ' | ');
                                            }

                                            let $hintLink = $('<a>', {
                                                href: 'javascript: void(0)',
                                                'class': 'hint',
                                                html: hint.title.replace(new RegExp(patternText, 'gi'), '<b>' + matchText + '</b>')
                                            });

                                            $hintLink.hover((event: Event) => {

                                                hintsBlockClear($hintsBlock);

                                                activeHintPosition = $(event.target)
                                                    .data('prev-active-hint-position', activeHintPosition)
                                                    .index();

                                            }, (event: Event) => {

                                                activeHintPosition = $(event.target).data('prev-active-hint-position');
                                            });

                                            $hintLink.on('click', (event: Event) => {

                                                let $hint = $(event.target);
                                                if (!$hint.is('a')) {
                                                    $hint = $hint.closest('a');
                                                }

                                                $field.val($hint.text());

                                                $hintsBlock.attr('style', '').empty();

                                                if (listeners['select'] instanceof Function) {
                                                    listeners['select'](hint);
                                                }
                                            });

                                            $hintsBlock
                                                .css('top', (+$field.height() + 12 + 2) + 'px') // for .form-control padding is 6px and border is 1px
                                                .prepend($hintLink);

                                            counter++;
                                        });

                                        if (counter) {
                                            $field.one('focusout', (event: FocusEvent) => {
                                                if (!event.relatedTarget) {
                                                    $hintsBlock.attr('style', '').empty();
                                                }
                                            });
                                        }
                                    }
                                }
                            });

                        } else {

                            $hintsBlock.attr('style', '').empty();
                        }
                    }
                });
        });
    }
});
