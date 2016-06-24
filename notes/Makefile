default:
	make all

all:
	make meetings
	make classes
	make csli

meetings:
	pandoc --smart \
		--standalone \
		--section-divs \
		--include-in-header style.css \
		-o build/meetings.html meet*.markdown

classes:
	pandoc --smart \
		--standalone \
		--section-divs \
		--include-in-header style.css \
		-o build/classes.html class*.markdown

csli:
	pandoc --smart \
		--standalone \
		--section-divs \
		--include-in-header style.css \
		-o build/csli.html csli*.markdown

pdf:
	pandoc --smart \
		--standalone \
		--section-divs \
		-o build/all.pdf *.markdown

clean:
	rm build/*
