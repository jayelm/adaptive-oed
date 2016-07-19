/*global module:false*/
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    // Metadata.
    pkg: grunt.file.readJSON('package.json'),
    banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
      '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
      '<%= pkg.homepage ? "* " + pkg.homepage + "\\n" : "" %>' +
      '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
      ' MIT License */\n',
    // Task configuration.
    concat: {
      options: {
        banner: '<%= banner %>',
        stripBanners: true
      },
      dist: {
        src: ['adaptive.js', 'acli.js', 'webppl.min.js'],
        dest: 'dist/<%= pkg.name %>.js',
        nonull: true
      }
    },
    clean: ['dist/*.js'],
    uglify: {
      options: {
        banner: '<%= banner %>'
      },
      dist: {
        src: '<%= concat.dist.dest %>',
        dest: 'dist/<%= pkg.name %>.min.js'
      }
    },
    jshint: {
      options: {
        curly: true,
        eqeqeq: true,
        immed: true,
        latedef: true,
        newcap: true,
        noarg: true,
        sub: true,
        undef: false, // Plenty of unused, since we assume webppl
        unused: true,
        boss: true,
        eqnull: true,
        globals: {
          jQuery: true
        }
      },
      gruntfile: {
        src: 'Gruntfile.js'
      },
      main: {
        src: ['adaptive.js']
      }
      // lib_test: {
        // src: ['lib/**/*.js', 'test/**/*.js']
      // }
    },
    nodeunit: {
      files: ['test/**/*_test.js']
    },
    watch: {
      gruntfile: {
        files: '<%= jshint.gruntfile.src %>',
        tasks: ['jshint:gruntfile']
      },
      lib_test: {
        files: '<%= jshint.lib_test.src %>',
        tasks: ['jshint:lib_test', 'nodeunit']
      }
    }
  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.registerTask('webppl', 'Build minified webppl.', function () {
    var done = this.async();

    grunt.log.writeln("Updating packages in node_modules/webppl");

    grunt.util.spawn({
      cmd: 'npm',
      args: ['install'],
      opts: {
        cwd: './node_modules/webppl/'
      }
    }, function(err, result, code) {
      if (err) {
        grunt.fail.fatal(err, code);
      }

      grunt.log.ok(result.stdout);

      grunt.log.writeln("Bundling webppl.min.js");

      // Now run grunt to bundle into webppl.min.js
      grunt.util.spawn({
        grunt: true,
        args: ['bundle:../webppl-oed/:../underscore/'],
        opts: {
          cwd: './node_modules/webppl/'
        }
      }, function (err, result, code) {
        if (err) {
          grunt.fail.fatal(err, code);
        }
        // Lastly, copy webppl.min.js into cwd
		grunt.util.spawn({
		  cmd: 'cp',
          args: ['./node_modules/webppl/bundle/webppl.min.js', '.'],
		}, function(err, result, code) {
          if (err) {
            grunt.fail.fatal(err, code);
          }
		  grunt.log.ok('Minified webppl copied to project directory');
          done();
		});
      });

	});
  });

  // Pseudo-browserify
  grunt.registerTask('browserify', 'Generate "dist/adaptive.js".', function() {
    var done = this.async();

    grunt.util.spawn({
      cmd: './concat',
    }, function(err, result, code) {
      if (err) {
        grunt.fail.fatal(err, code);
      }
      done();
    });
  });

  // Default task.
  grunt.registerTask('default', ['browserify']);
};
